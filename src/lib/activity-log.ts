import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import type { ActivityType } from '@/types/db';

/**
 * Server-side activity emission — the single place actions record events into the
 * feed. Wraps the SECURITY DEFINER `log_activity` RPC (which pins the actor to
 * `auth.uid()` and guards cross-feed writes). Emission is **best-effort**: a logging
 * failure never fails the parent action, so recording an expense/settlement/etc. can't
 * break just because the feed write did.
 */

type Client = SupabaseClient<Database>;

/** One event to append, from the caller's point of view. */
export interface ActivityEventInput {
  /** Whose feed this lands in (the current user, or a connected account). */
  ownerId: string;
  type: ActivityType;
  subject?: string | null;
  expenseId?: string | null;
  groupId?: string | null;
  memberId?: string | null;
  settlementId?: string | null;
  /** Name of the group/expense it happened in, for the notification's context. */
  contextLabel?: string | null;
  amountCents?: number | null;
  currency?: string | null;
}

/** Append a batch of events to their feeds. Silently no-ops on error. */
export async function logActivity(
  supabase: Client,
  events: ActivityEventInput[],
): Promise<void> {
  if (events.length === 0) return;
  const payload = events.map((event) => ({
    owner_id: event.ownerId,
    type: event.type,
    subject: event.subject ?? null,
    expense_id: event.expenseId ?? null,
    group_id: event.groupId ?? null,
    member_id: event.memberId ?? null,
    settlement_id: event.settlementId ?? null,
    context_label: event.contextLabel ?? null,
    amount_cents: event.amountCents ?? null,
    currency: event.currency ?? null,
  }));
  try {
    await supabase.rpc('log_activity', { p_events: payload });
  } catch {
    // Best-effort — never fail the parent action on a logging error.
  }
}

/**
 * The distinct real accounts behind a set of the caller's member ids — i.e. the
 * `linked_user_id`s (excluding `excludeUserId`, normally the actor). These are the
 * connected accounts whose feeds should also learn about an expense/settlement the
 * action touched.
 */
export async function getLinkedUserIds(
  supabase: Client,
  memberIds: string[],
  excludeUserId: string,
): Promise<string[]> {
  return (await getLinkedMembers(supabase, memberIds, excludeUserId)).map(
    (entry) => entry.userId,
  );
}

/** A member that belongs to a real account, and which account that is. */
export interface LinkedMember {
  memberId: string;
  userId: string;
}

/**
 * Like {@link getLinkedUserIds}, but keeps the member→account pairing. Needed when an
 * event carries a figure that differs *per recipient* — e.g. telling each participant
 * what THEY owe on an expense requires knowing which member row is theirs.
 */
export async function getLinkedMembers(
  supabase: Client,
  memberIds: string[],
  excludeUserId: string,
): Promise<LinkedMember[]> {
  if (memberIds.length === 0) return [];
  const { data } = await supabase
    .from('members')
    .select('id, linked_user_id')
    .in('id', memberIds)
    .not('linked_user_id', 'is', null);

  const seen = new Set<string>();
  const linked: LinkedMember[] = [];
  for (const row of data ?? []) {
    if (!row.linked_user_id || row.linked_user_id === excludeUserId) continue;
    if (seen.has(row.linked_user_id)) continue;
    seen.add(row.linked_user_id);
    linked.push({ memberId: row.id, userId: row.linked_user_id });
  }
  return linked;
}
