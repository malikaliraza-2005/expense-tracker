'use server';

import { revalidatePath } from 'next/cache';

import { DEFAULT_CURRENCY } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  validateRecordSettlement,
  type RecordSettlementFormInput,
} from '@/schemas/settlement.schema';
import type { ActionResult } from '@/types';
import type { Settlement } from '@/types/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Settlement Server Actions (Phase 5). The only place settlements are written.
 * `recordSettlement`:
 *   1. re-validates the input shape (defense in depth over the dialog),
 *   2. re-derives the allowed party set on the server — group members for a
 *      group settlement, or the user + their friends for a personal one — and
 *      rejects any payer/receiver outside it,
 *   3. requires the current user to be one of the two parties, and
 *   4. writes the row. RLS is the final backstop under all of this.
 *
 * Balances are never stored: a recorded settlement re-nets against the ledger on
 * the next read (lib/balances.ts), so every affected view updates on revalidate.
 */

type Client = SupabaseClient<Database>;

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** The current user's friend ids (either friendship direction). */
async function getFriendIds(
  supabase: Client,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.user_id === userId ? row.friend_id : row.user_id);
  }
  return ids;
}

/** The member ids of a group (RLS-scoped: empty unless the caller is a member). */
async function getGroupMemberIds(
  supabase: Client,
  groupId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);
  return new Set((data ?? []).map((row) => row.user_id));
}

/** The set of people the current user may settle with in `groupId` (or personal). */
async function allowedParties(
  supabase: Client,
  userId: string,
  groupId: string | null,
): Promise<{ ok: true; ids: Set<string> } | { ok: false; error: string }> {
  if (groupId) {
    const memberIds = await getGroupMemberIds(supabase, groupId);
    if (!memberIds.has(userId)) {
      return { ok: false, error: 'You are not a member of this group.' };
    }
    return { ok: true, ids: memberIds };
  }
  const friendIds = await getFriendIds(supabase, userId);
  friendIds.add(userId); // a settlement always involves the user.
  return { ok: true, ids: friendIds };
}

/**
 * Record a settlement (a real transfer of money) between two people. Validates,
 * authorizes both parties and the caller, then writes the row.
 */
export async function recordSettlement(
  input: RecordSettlementFormInput,
): Promise<ActionResult<Settlement>> {
  const parsed = validateRecordSettlement(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid settlement.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { groupId, payerId, receiverId, amountCents, note } = parsed.data;

  // The caller must be one of the two parties (RLS enforces this too).
  if (payerId !== user.id && receiverId !== user.id) {
    return {
      ok: false,
      error: 'You can only record a settlement you are part of.',
    };
  }

  const allowed = await allowedParties(supabase, user.id, groupId);
  if (!allowed.ok) return allowed;

  if (!allowed.ids.has(payerId) || !allowed.ids.has(receiverId)) {
    return {
      ok: false,
      error: groupId
        ? 'Both people must be members of this group.'
        : 'You can only settle up with yourself and your friends.',
    };
  }

  const { data, error } = await supabase
    .from('settlements')
    .insert({
      group_id: groupId,
      payer_id: payerId,
      receiver_id: receiverId,
      amount_cents: amountCents,
      currency: DEFAULT_CURRENCY,
      note,
    })
    .select()
    .single();

  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  // Balances surface on many views — refresh all of them. The counterparty is
  // whichever party is not the caller.
  const counterpartyId = payerId === user.id ? receiverId : payerId;
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.friends);
  revalidatePath(`/friends/${counterpartyId}`);
  revalidatePath(ROUTES.groups);
  if (groupId) revalidatePath(`/groups/${groupId}`);

  return { ok: true, data };
}
