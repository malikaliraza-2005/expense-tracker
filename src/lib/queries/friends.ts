import { cache } from 'react';

import { friendStatus } from '@/lib/friends';
import { getBalances } from '@/lib/queries/balances';
import { createClient } from '@/lib/supabase/server';
import type { Member } from '@/types/db';
import type { FriendListItem } from '@/types/dto';

/**
 * Friend reads (Phase 4). A "friend" is one of the owner's members who is either
 * linked to a real account (`linked_user_id`) or at least reachable by email (so
 * they can be invited and later linked) — the subject of the Friends page. Plain
 * name-only members with no email are people you split with but haven't reached
 * out to; they stay on Expense Detail and are omitted here.
 *
 * The per-friend net comes from the shared balance engine (via queries/balances),
 * never recomputed; the linking status is derived by the pure `friendStatus`.
 */
export const getFriends = cache(async (): Promise<FriendListItem[]> => {
  const supabase = createClient();

  // getBalances() ensures the self-member and nets the ledger; run the member and
  // pending-invite reads alongside it.
  const [membersRes, balances, pendingRes] = await Promise.all([
    supabase.from('members').select('*'),
    getBalances(),
    supabase.from('invitations').select('member_id').eq('status', 'pending'),
  ]);

  const pendingMemberIds = new Set(
    (pendingRes.data ?? []).map((row) => row.member_id),
  );
  const netById = new Map(balances.map((b) => [b.memberId, b.netCents]));

  const friends = (membersRes.data ?? []).filter(
    (m: Member) => !m.is_self && (m.linked_user_id !== null || m.email !== null),
  );

  return friends
    .map((member: Member) => ({
      member,
      netCents: netById.get(member.id) ?? 0,
      status: friendStatus({
        linkedUserId: member.linked_user_id,
        hasPendingInvite: pendingMemberIds.has(member.id),
      }),
    }))
    .sort((a, b) => {
      // Linked friends first, then those with a live invite, then the rest;
      // alphabetical within each band.
      const rank = (s: FriendListItem['status']) =>
        s === 'linked' ? 0 : s === 'invited' ? 1 : 2;
      return (
        rank(a.status) - rank(b.status) ||
        a.member.name.localeCompare(b.member.name)
      );
    });
});
