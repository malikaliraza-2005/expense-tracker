import { cache } from 'react';

import { getBalances, getMemberBalance } from '@/lib/queries/balances';
import { createClient } from '@/lib/supabase/server';
import type { MemberBalanceDetail, MemberWithBalance } from '@/types/dto';
import type { Member } from '@/types/db';

/**
 * Member reads. Typed data-access over the owner-scoped `members` table, with the
 * per-member net supplied by the balance engine (reused via queries/balances.ts,
 * not recomputed). The owner's self-member is ensured on read (balances calls
 * `ensure_self_member`), so it always appears.
 */

/** All of the owner's members, self first then alphabetical. */
export const getMembers = cache(async (): Promise<Member[]> => {
  const supabase = createClient();

  // Ensure the self-member exists before listing.
  await supabase.rpc('ensure_self_member');

  const { data } = await supabase.from('members').select('*');
  const members = data ?? [];
  members.sort((a, b) => {
    if (a.is_self !== b.is_self) return a.is_self ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return members;
});

/** The owner's members, each with the net balance between them and the owner. */
export const getMembersWithBalances = cache(
  async (): Promise<MemberWithBalance[]> => {
    const [members, balances] = await Promise.all([getMembers(), getBalances()]);
    const netById = new Map(balances.map((b) => [b.memberId, b.netCents]));
    return members.map((member) => ({
      member,
      netCents: netById.get(member.id) ?? 0,
    }));
  },
);

/** One member and the owner's net balance with them, or `null` when unknown. */
export async function getMemberDetail(
  memberId: string,
): Promise<MemberBalanceDetail | null> {
  const supabase = createClient();

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .single<Member>();
  if (!member) return null;

  const netCents = await getMemberBalance(memberId);
  return { member, netCents };
}
