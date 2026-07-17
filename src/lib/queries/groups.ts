import { summarize } from '@/lib/balances';
import {
  getGroupBalances,
  getGroupLedgerDebts,
  getGroupMemberStats,
} from '@/lib/queries/balances';
import { createClient } from '@/lib/supabase/server';
import type {
  GroupDetail,
  GroupMemberDto,
  GroupMemberStatDto,
  GroupWithBalance,
  LedgerEntry,
} from '@/types/dto';
import type { Group, Member } from '@/types/db';

/**
 * Group reads. Typed data-access over the owner-scoped `groups` / `group_members`
 * tables, joined to `members` and to the derived balance figures from the engine
 * (reused via queries/balances.ts, not recomputed). RLS scopes everything to the
 * owner; the balance context is request-cached, so per-group balance calls share
 * a single set of reads.
 */

/** Fetch member rows for a set of ids, keyed by id. */
async function fetchMembersById(ids: string[]): Promise<Map<string, Member>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase.from('members').select('*').in('id', ids);
  return new Map((data ?? []).map((member) => [member.id, member]));
}

/** Self-member first, then alphabetical — the standard member ordering. */
function orderMembers(a: GroupMemberDto, b: GroupMemberDto): number {
  if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
  return a.member.name.localeCompare(b.member.name);
}

/** All of the owner's groups with a member count and the owner's net within each. */
export async function listGroups(): Promise<GroupWithBalance[]> {
  const supabase = createClient();
  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false });
  if (!groups || groups.length === 0) return [];

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id');
  const countByGroup = new Map<string, number>();
  for (const row of memberships ?? []) {
    countByGroup.set(row.group_id, (countByGroup.get(row.group_id) ?? 0) + 1);
  }

  const result: GroupWithBalance[] = [];
  for (const group of groups as Group[]) {
    const { netCents } = summarize(await getGroupBalances(group.id));
    result.push({
      group,
      memberCount: countByGroup.get(group.id) ?? 0,
      netCents,
    });
  }
  return result;
}

/** One group by id, or null when it isn't the owner's. */
export async function getGroup(groupId: string): Promise<Group | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single<Group>();
  return data ?? null;
}

/**
 * Every member of a group with their in-group paid / share / net figures. Group
 * members with no activity yet are included with zeroes so the Members page can
 * list them; ordering is self-member first, then alphabetical.
 */
export async function getGroupMembersWithStats(
  groupId: string,
): Promise<GroupMemberStatDto[]> {
  const supabase = createClient();
  const [{ data: memberships }, stats, ownerBalances] = await Promise.all([
    supabase.from('group_members').select('member_id').eq('group_id', groupId),
    getGroupMemberStats(groupId),
    getGroupBalances(groupId),
  ]);

  const memberIds = (memberships ?? []).map((row) => row.member_id);
  const membersById = await fetchMembersById(memberIds);
  const statById = new Map(stats.map((s) => [s.memberId, s]));
  const ownerNetById = new Map(ownerBalances.map((b) => [b.memberId, b.netCents]));

  return memberIds
    .map((id) => {
      const member = membersById.get(id);
      if (!member) return null;
      const stat = statById.get(id);
      return {
        member,
        isSelf: member.is_self,
        paidCents: stat?.paidCents ?? 0,
        owesCents: stat?.owesCents ?? 0,
        netCents: stat?.netCents ?? 0,
        ownerNetCents: ownerNetById.get(id) ?? 0,
      };
    })
    .filter((entry): entry is GroupMemberStatDto => entry !== null)
    .sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return a.member.name.localeCompare(b.member.name);
    });
}

/** One group with its members and the owner's balance summary within it. */
export async function getGroupDetail(
  groupId: string,
): Promise<GroupDetail | null> {
  const supabase = createClient();
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single<Group>();
  if (!group) return null;

  const { data: memberships } = await supabase
    .from('group_members')
    .select('member_id')
    .eq('group_id', groupId);
  const memberIds = (memberships ?? []).map((row) => row.member_id);
  const membersById = await fetchMembersById(memberIds);

  const members: GroupMemberDto[] = memberIds
    .map((id) => {
      const member = membersById.get(id);
      return member ? { member, isSelf: member.is_self } : null;
    })
    .filter((entry): entry is GroupMemberDto => entry !== null)
    .sort(orderMembers);

  const { owedToMeCents, iOweCents, netCents } = summarize(
    await getGroupBalances(groupId),
  );

  return {
    group,
    members,
    summary: {
      memberCount: members.length,
      owedToMeCents,
      iOweCents,
      netCents,
    },
  };
}

/** The full who-owes-whom ledger within a group, resolved to member objects. */
export async function getGroupLedger(groupId: string): Promise<LedgerEntry[]> {
  const debts = await getGroupLedgerDebts(groupId);
  if (debts.length === 0) return [];

  const membersById = await fetchMembersById([
    ...new Set(debts.flatMap((debt) => [debt.fromId, debt.toId])),
  ]);

  const entries: LedgerEntry[] = [];
  for (const debt of debts) {
    const from = membersById.get(debt.fromId);
    const to = membersById.get(debt.toId);
    if (!from || !to) continue;
    entries.push({ from, to, amountCents: debt.amountCents });
  }
  return entries;
}
