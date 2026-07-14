import { cache } from 'react';

import { summarize } from '@/lib/balances';
import { getGroupBalances } from '@/lib/queries/balances';
import { createClient } from '@/lib/supabase/server';
import type {
  GroupDetail,
  GroupLedger,
  GroupMemberProfile,
  GroupWithBalance,
  LedgerEntry,
} from '@/types/dto';
import type { Profile } from '@/types/db';

/**
 * Group reads (Phase 3). Typed data-access over the RLS-scoped `groups` /
 * `group_members` tables, joined to `profiles`, with per-group balances supplied
 * by the balance engine (reused via queries/balances.ts, not recomputed).
 *
 * RLS does the scoping: `groups` returns only groups the caller belongs to or
 * owns, and `group_members` only rows of those groups — so these helpers never
 * need to re-filter by membership.
 */

/** Fetch the member profiles for a set of member ids, keyed by id. */
async function fetchProfilesById(
  ids: string[],
): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').in('id', ids);
  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

/**
 * All groups visible to the current user, each with its member count and the
 * user's net balance within the group. Sorted newest first.
 */
export const getGroups = cache(async (): Promise<GroupWithBalance[]> => {
  const supabase = createClient();

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false });

  if (!groups || groups.length === 0) return [];

  const groupIds = groups.map((group) => group.id);
  const { data: members } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const countByGroup = new Map<string, number>();
  for (const member of members ?? []) {
    countByGroup.set(
      member.group_id,
      (countByGroup.get(member.group_id) ?? 0) + 1,
    );
  }

  const result: GroupWithBalance[] = [];
  for (const group of groups) {
    const balances = await getGroupBalances(group.id);
    const { netCents } = summarize(balances);
    result.push({
      group,
      memberCount: countByGroup.get(group.id) ?? 0,
      netCents,
    });
  }
  return result;
});

/** The members of a group joined to their profiles, owner first then by name. */
export async function getGroupMembers(
  groupId: string,
): Promise<GroupMemberProfile[]> {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from('group_members')
    .select('user_id, role')
    .eq('group_id', groupId);

  if (!rows || rows.length === 0) return [];

  const profilesById = await fetchProfilesById(rows.map((r) => r.user_id));

  const members: GroupMemberProfile[] = rows
    .map((row) => {
      const profile = profilesById.get(row.user_id);
      if (!profile) return null;
      return { userId: row.user_id, role: row.role, profile };
    })
    .filter((member): member is GroupMemberProfile => member !== null);

  members.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;
    return (a.profile.full_name || '').localeCompare(b.profile.full_name || '');
  });
  return members;
}

/**
 * Full detail for one group: the group row, its members, a current-user-scoped
 * balance summary, and whether the caller owns it. Returns `null` when the group
 * is not visible to the caller (RLS-hidden or nonexistent).
 */
export async function getGroup(groupId: string): Promise<GroupDetail | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (!group) return null;

  const members = await getGroupMembers(groupId);
  const balances = await getGroupBalances(groupId);
  const { owedToMeCents, iOweCents, netCents } = summarize(balances);

  return {
    group,
    members,
    summary: {
      memberCount: members.length,
      owedToMeCents,
      iOweCents,
      netCents,
    },
    isOwner: group.created_by === user.id,
  };
}

/**
 * The group's who-owes-whom ledger from the current user's perspective: each of
 * their non-zero balances within the group as a directed `from → to` debt. Empty
 * until expenses exist (Phase 4). Reuses the balance engine.
 */
export async function getGroupLedger(groupId: string): Promise<GroupLedger> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { entries: [] };

  const balances = await getGroupBalances(groupId);
  if (balances.length === 0) return { entries: [] };

  const ids = [user.id, ...balances.map((b) => b.userId)];
  const profilesById = await fetchProfilesById(ids);
  const me = profilesById.get(user.id);
  if (!me) return { entries: [] };

  const entries: LedgerEntry[] = [];
  for (const balance of balances) {
    const other = profilesById.get(balance.userId);
    if (!other) continue;
    if (balance.netCents > 0) {
      // They owe me.
      entries.push({ from: other, to: me, amountCents: balance.netCents });
    } else if (balance.netCents < 0) {
      // I owe them.
      entries.push({ from: me, to: other, amountCents: -balance.netCents });
    }
  }
  return { entries };
}
