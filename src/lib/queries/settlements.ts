import { createClient } from '@/lib/supabase/server';
import type { SettlementListItem } from '@/types/dto';
import type { Profile, Settlement } from '@/types/db';

/**
 * Settlement reads (Phase 5). Typed data-access over the RLS-scoped `settlements`
 * table joined to the payer and receiver `profiles`. RLS does the scoping — the
 * select policy returns only settlements the caller is party to (or a member of
 * the settlement's group) — so these helpers never re-filter by visibility.
 *
 * Settlements feed the balance engine (lib/balances.ts) for figures; these reads
 * are for the human-readable activity lists (dashboard, friend/group history).
 */

/** Optional list scoping for {@link listSettlements}. */
export interface SettlementFilter {
  /** Restrict to a single group's settlements. */
  groupId?: string;
  /** Restrict to settlements involving a specific counterparty. */
  withUserId?: string;
  /** Cap the number of rows returned (newest first). */
  limit?: number;
}

/** Fetch profile rows for a set of ids, keyed by id. */
async function fetchProfilesById(
  ids: string[],
): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').in('id', ids);
  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

/**
 * Settlements visible to the current user, joined to payer and receiver profiles,
 * newest first. Optionally scoped to one group, one counterparty, and/or capped.
 */
export async function listSettlements(
  filter?: SettlementFilter,
): Promise<SettlementListItem[]> {
  const supabase = createClient();

  let query = supabase.from('settlements').select('*');
  if (filter?.groupId) query = query.eq('group_id', filter.groupId);
  if (filter?.withUserId) {
    query = query.or(
      `payer_id.eq.${filter.withUserId},receiver_id.eq.${filter.withUserId}`,
    );
  }

  query = query.order('settled_at', { ascending: false });
  if (filter?.limit) query = query.limit(filter.limit);

  const { data: settlements } = await query.returns<Settlement[]>();
  if (!settlements || settlements.length === 0) return [];

  const profilesById = await fetchProfilesById([
    ...new Set(
      settlements.flatMap((s) => [s.payer_id, s.receiver_id]),
    ),
  ]);

  const items: SettlementListItem[] = [];
  for (const settlement of settlements) {
    const payer = profilesById.get(settlement.payer_id);
    const receiver = profilesById.get(settlement.receiver_id);
    if (!payer || !receiver) continue; // skip rows we can't fully resolve
    items.push({ settlement, payer, receiver });
  }
  return items;
}
