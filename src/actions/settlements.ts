'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

import { safeCurrency } from '@/constants/currencies';
import { ROUTES } from '@/constants/routes';
import { logActivity, type ActivityEventInput } from '@/lib/activity-log';
import { balanceWith } from '@/lib/balances';
import { getBalanceRows } from '@/lib/queries/balances';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  validateRecordSettlement,
  type RecordSettlementFormInput,
} from '@/schemas/settlement.schema';
import type { ActionResult } from '@/types';

/**
 * Settlement Server Actions. The only place transfers between members are
 * written. A settlement nets against outstanding debt in the balance engine, so
 * recording one is how a balance actually gets cleared (fully, or partially when
 * the amount is less than the current net).
 *
 * Re-validates input, verifies both parties are the caller's own members, and
 * relies on owner-scoped RLS (owner_id = auth.uid()) as the backstop. Inserts
 * without RETURNING to avoid the RETURNING/RLS interaction noted in migration
 * 0009. Expected failures are returned, never thrown.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.';

async function resolveLinkedMemberId(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  linkedUserId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('linked_user_id', linkedUserId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Record a transfer from `payerId` to `receiverId`, clearing that much debt. */
export async function recordSettlement(
  input: RecordSettlementFormInput,
): Promise<ActionResult> {
  const parsed = validateRecordSettlement(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstError(parsed.errors) ?? 'Invalid settlement.',
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Both parties must be the caller's own members. RLS scopes settlements by
  // owner_id but not the referenced member ids, so verify ownership explicitly.
  const { data: owned } = await supabase
    .from('members')
    .select('id')
    .eq('owner_id', user.id)
    .in('id', [parsed.data.payerId, parsed.data.receiverId]);
  if (!owned || owned.length < 2) {
    return { ok: false, error: 'Both people must be your members.' };
  }

  // A group-scoped settlement must reference the caller's own group, and both
  // parties must belong to it — otherwise it would land in a ledger they aren't
  // part of. This keeps each group's balances isolated.
  const groupId = parsed.data.groupId;
  if (groupId) {
    const [{ data: group }, { data: groupMembers }] = await Promise.all([
      supabase
        .from('groups')
        .select('id')
        .eq('id', groupId)
        .eq('owner_id', user.id)
        .single(),
      supabase
        .from('group_members')
        .select('member_id')
        .eq('group_id', groupId)
        .in('member_id', [parsed.data.payerId, parsed.data.receiverId]),
    ]);
    if (!group) return { ok: false, error: 'Group not found.' };
    if (!groupMembers || groupMembers.length < 2) {
      return { ok: false, error: 'Both people must be members of this group.' };
    }
  }

  // Cap the amount at what is ACTUALLY outstanding between these two, across every
  // scope — the same rule `settleWithMember` applies, which this action was missing.
  //
  // It is not just belt-and-braces. A settlement's group_id is a label: the global net
  // counts every settlement, but a GROUP net counts only settlements tagged with that
  // group (`restrictToGroup` in lib/balances.ts). So a payment recorded from Activity or
  // Friends — which pass no groupId — clears the global debt while the group page still
  // shows it outstanding, with a Settle-up button next to it. Recording it a second time
  // used to be accepted and drove the balance PAST zero, telling the payee they now owed
  // money they had just been paid. Capping against the global net means the second
  // attempt is refused instead: the debt really is gone, whatever the group lens says.
  const rows = await getBalanceRows();
  const outstanding = balanceWith(
    parsed.data.receiverId,
    parsed.data.payerId,
    rows,
  );
  if (outstanding <= 0) {
    return { ok: false, error: 'That balance is already settled.' };
  }
  if (parsed.data.amountCents > outstanding) {
    return { ok: false, error: 'That’s more than the outstanding balance.' };
  }

  // Store the payment in the account's currency (the one every amount displays
  // in), consistent with how expenses are recorded.
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_currency')
    .eq('id', user.id)
    .single();
  const currency = safeCurrency(profile?.preferred_currency);

  const { error } = await supabase.from('settlements').insert({
    owner_id: user.id,
    payer_id: parsed.data.payerId,
    receiver_id: parsed.data.receiverId,
    amount_cents: parsed.data.amountCents,
    currency,
    note: parsed.data.note,
    group_id: groupId,
  });
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.expenses);

  // Activity: "You settled … with X in “Group”" on my feed; "… settled … with you"
  // on each linked party's feed. The counterparty (for my line) is the non-self party;
  // the group name gives the notification its context and its deep-link target.
  const [{ data: parties }, { data: group }] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, is_self, linked_user_id')
      .in('id', [parsed.data.payerId, parsed.data.receiverId]),
    groupId
      ? supabase.from('groups').select('name').eq('id', groupId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const payer = parties?.find((p) => p.id === parsed.data.payerId);
  const receiver = parties?.find((p) => p.id === parsed.data.receiverId);
  const counterparty = payer?.is_self ? receiver : receiver?.is_self ? payer : receiver;
  const contextLabel = group?.name ?? null;

  const events: ActivityEventInput[] = [
    {
      ownerId: user.id,
      type: 'settlement_recorded',
      subject: counterparty?.name ?? 'someone',
      expenseId: parsed.data.expenseId,
      amountCents: parsed.data.amountCents,
      currency,
      groupId,
      contextLabel,
      // Lets a non-group settlement deep-link to the expenses with this person.
      memberId: counterparty?.id ?? null,
    },
  ];
  for (const party of [payer, receiver]) {
    if (party?.linked_user_id && party.linked_user_id !== user.id) {
      const memberId = await resolveLinkedMemberId(
        supabase,
        party.linked_user_id,
        user.id,
      );
      events.push({
        ownerId: party.linked_user_id,
        type: 'settlement_received',
        amountCents: parsed.data.amountCents,
        currency,
        expenseId: parsed.data.expenseId,
        groupId,
        contextLabel,
        memberId,
      });
    }
  }
  await logActivity(supabase, events);

  return { ok: true, data: undefined };
}

/**
 * Settle a balance with one member — callable by **either** party: the ledger owner,
 * or the account that member represents (their `linked_user_id`). This is what makes a
 * settlement symmetric: whoever pays can record it, and it lands as a **single shared
 * row** in the ledger that owns the balance, so the same payment can never be entered
 * twice (once per side) and both accounts derive the same net from it.
 *
 * The direction is derived from the *owner-perspective* net, so both callers compute
 * the same answer from the same rows. The amount is capped at what's actually
 * outstanding — which is also what prevents settling an already-settled balance: once
 * the net reaches 0 there is nothing left to record.
 */
export async function settleWithMember(input: {
  memberId?: unknown;
  amountCents?: unknown;
  groupId?: unknown;
}): Promise<ActionResult> {
  const memberId =
    typeof input?.memberId === 'string' ? input.memberId.trim() : '';
  const amountCents =
    typeof input?.amountCents === 'number' ? Math.round(input.amountCents) : 0;
  const groupId = typeof input?.groupId === 'string' ? input.groupId : null;
  if (!memberId) return { ok: false, error: 'Missing person.' };
  if (amountCents <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // The member the balance is with, and the self-member on the other side of it.
  const { data: member } = await supabase
    .from('members')
    .select('id, owner_id, name, linked_user_id, is_self')
    .eq('id', memberId)
    .maybeSingle();
  if (!member || member.is_self) {
    return { ok: false, error: 'Person not found.' };
  }
  const callerIsOwner = member.owner_id === user.id;
  if (!callerIsOwner && member.linked_user_id !== user.id) {
    return { ok: false, error: 'You’re not part of that balance.' };
  }

  const { data: ledgerSelf } = await supabase
    .from('members')
    .select('id, name')
    .eq('owner_id', member.owner_id)
    .eq('is_self', true)
    .maybeSingle();
  if (!ledgerSelf) return { ok: false, error: GENERIC_ERROR };

  // Net from the LEDGER OWNER's point of view (> 0 the member owes them). Both
  // parties derive this identically from the same shared rows.
  const rows = await getBalanceRows();
  const ownerNet = balanceWith(ledgerSelf.id, member.id, rows);
  if (ownerNet === 0) {
    return { ok: false, error: 'That balance is already settled.' };
  }
  if (amountCents > Math.abs(ownerNet)) {
    return { ok: false, error: 'That’s more than the outstanding balance.' };
  }

  const { data: settlementId, error } = await supabase.rpc('settle_member', {
    p_member_id: member.id,
    p_amount_cents: amountCents,
    p_member_pays: ownerNet > 0,
    p_group_id: groupId,
  });
  if (error || !settlementId) return { ok: false, error: GENERIC_ERROR };

  // Notify both sides. From my feed it reads "You settled … with X"; the other
  // account sees "… settled … with you".
  const counterpartyAccount = callerIsOwner ? member.linked_user_id : member.owner_id;
  const counterpartyName = callerIsOwner ? member.name : ledgerSelf.name;
  const [{ data: profile }, { data: group }] = await Promise.all([
    supabase
      .from('profiles')
      .select('preferred_currency')
      .eq('id', member.owner_id)
      .maybeSingle(),
    groupId
      ? supabase.from('groups').select('name').eq('id', groupId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const currency = safeCurrency(profile?.preferred_currency);
  const contextLabel = group?.name ?? null;

  const ownFeedMemberId = callerIsOwner
    ? member.id
    : await resolveLinkedMemberId(supabase, user.id, member.owner_id);

  const events: ActivityEventInput[] = [
    {
      ownerId: user.id,
      type: 'settlement_recorded',
      subject: counterpartyName,
      amountCents,
      currency,
      groupId,
      contextLabel,
      settlementId,
      memberId: ownFeedMemberId,
    },
  ];
  if (counterpartyAccount) {
    const counterpartyMemberId = callerIsOwner
      ? await resolveLinkedMemberId(supabase, counterpartyAccount, user.id)
      : member.id;

    events.push({
      ownerId: counterpartyAccount,
      type: 'settlement_received',
      amountCents,
      currency,
      groupId,
      contextLabel,
      settlementId,
      memberId: counterpartyMemberId,
    });
  }
  await logActivity(supabase, events);

  // Realtime fans the settlement out to every affected account; refresh our own
  // shell so balances re-derive immediately here too.
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}

/**
 * Delete a recorded settlement, restoring the balance it had cleared. Callable by
 * either party — whoever recorded it can undo it — via the `unsettle_member` RPC,
 * which mirrors `settle_member`'s authorization.
 *
 * It goes through the RPC rather than a direct DELETE for a reason: settlements are
 * owner-scoped for writes, so a participant's DELETE silently matches zero rows and
 * RLS reports that as success, not an error. This used to tell the user their payment
 * was removed while it was still there. The RPC returns whether a row actually went,
 * and a no-op is now surfaced as a failure instead of being swallowed.
 */
export async function deleteSettlement(input: {
  settlementId?: unknown;
}): Promise<ActionResult> {
  const settlementId =
    typeof input?.settlementId === 'string' ? input.settlementId.trim() : '';
  if (!settlementId) return { ok: false, error: 'Missing settlement.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data: removed, error } = await supabase.rpc('unsettle_member', {
    p_settlement_id: settlementId,
  });
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (!removed) {
    return { ok: false, error: 'That payment couldn’t be removed.' };
  }

  // Balances derive from settlements, so a removal moves figures app-wide; refresh the
  // whole shell rather than just the two pages this used to touch.
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}
