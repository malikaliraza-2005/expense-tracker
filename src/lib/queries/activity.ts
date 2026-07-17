import { cache } from 'react';

import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { ActivityType } from '@/types/db';
import type { ActivityItem } from '@/types/dto';

/**
 * Activity feed reads (Phase 1). Every row is owned by exactly one user's feed and
 * RLS returns only the caller's own (`owner_id = auth.uid()`), so these are simple
 * owner-scoped reads with no cross-account joins — the display strings are already
 * denormalized on each row.
 */

const FEED_LIMIT = 100;

/** The current user's activity, newest first. */
export const getActivity = cache(async (): Promise<ActivityItem[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from('activity_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT);

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type as ActivityType,
    actorId: row.actor_id,
    actorName: row.actor_name,
    subject: row.subject,
    expenseId: row.expense_id,
    groupId: row.group_id,
    memberId: row.member_id,
    settlementId: row.settlement_id,
    contextLabel: row.context_label,
    amountCents: row.amount_cents,
    currency: row.currency,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
});

/** Count of the current user's unread activity — the entry-point badge. */
export const getUnreadActivityCount = cache(async (): Promise<number> => {
  const user = await getUser();
  if (!user) return 0;

  const supabase = createClient();
  const { count } = await supabase
    .from('activity_events')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  return count ?? 0;
});
