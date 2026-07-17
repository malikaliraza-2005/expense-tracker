'use server';

import { revalidatePath } from 'next/cache';

import { safeCurrency } from '@/constants/currencies';
import { ROUTES } from '@/constants/routes';
import { logActivity, type ActivityEventInput } from '@/lib/activity-log';
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
      amountCents: parsed.data.amountCents,
      currency,
      groupId,
      contextLabel,
    },
  ];
  for (const party of [payer, receiver]) {
    if (party?.linked_user_id && party.linked_user_id !== user.id) {
      events.push({
        ownerId: party.linked_user_id,
        type: 'settlement_received',
        amountCents: parsed.data.amountCents,
        currency,
        groupId,
        contextLabel,
      });
    }
  }
  await logActivity(supabase, events);

  return { ok: true, data: undefined };
}

/** Delete a recorded settlement, restoring the balance it had cleared. */
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

  const { error } = await supabase
    .from('settlements')
    .delete()
    .eq('id', settlementId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.expenses);
  return { ok: true, data: undefined };
}
