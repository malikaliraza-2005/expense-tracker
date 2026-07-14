import { cache } from 'react';

import { getBalances, getFriendBalance } from '@/lib/queries/balances';
import { createClient } from '@/lib/supabase/server';
import type { FriendBalanceDetail, FriendWithBalance } from '@/types/dto';
import type { Friendship, Profile } from '@/types/db';

/**
 * Friend reads (Phase 3). Typed data-access over the RLS-scoped `friendships`
 * table joined to `profiles`, with the per-friend net supplied by the balance
 * engine (lib/balances.ts, via queries/balances.ts) — reused rather than
 * recomputed here.
 *
 * A friendship is a single directional row (see database-design.md §2.2); RLS
 * lets either party read it, so the current user's friends are all rows where
 * they are `user_id` OR `friend_id`, and the friend is the other party.
 */

/** Raw friendship rows the current user is party to. */
const getMyFriendships = cache(async (): Promise<Friendship[]> => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  if (error || !data) return [];
  return data;
});

/**
 * The current user's friends, each with the net balance between them, sorted by
 * display name. Deduped by friend id in case both directional rows exist.
 */
export const getFriends = cache(async (): Promise<FriendWithBalance[]> => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const friendships = await getMyFriendships();
  if (friendships.length === 0) return [];

  // Map each friend's profile id → the friendship row that links us.
  const friendshipByFriendId = new Map<string, Friendship>();
  for (const friendship of friendships) {
    const friendId =
      friendship.user_id === user.id ? friendship.friend_id : friendship.user_id;
    if (!friendshipByFriendId.has(friendId)) {
      friendshipByFriendId.set(friendId, friendship);
    }
  }

  const friendIds = [...friendshipByFriendId.keys()];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', friendIds);

  const balances = await getBalances();
  const netByUser = new Map(balances.map((b) => [b.userId, b.netCents]));

  const result: FriendWithBalance[] = (profiles ?? []).map((profile) => ({
    friendshipId: friendshipByFriendId.get(profile.id)!.id,
    profile,
    netCents: netByUser.get(profile.id) ?? 0,
  }));

  result.sort((a, b) =>
    (a.profile.full_name || '').localeCompare(b.profile.full_name || ''),
  );
  return result;
});

/**
 * One friend's profile and the current user's net balance with them, or `null`
 * when the id is not a friend the caller can see. Powers the friend detail page.
 */
export async function getFriendDetail(
  friendId: string,
): Promise<FriendBalanceDetail | null> {
  const supabase = createClient();

  const friendships = await getMyFriendships();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isFriend = friendships.some(
    (f) =>
      (f.user_id === user.id && f.friend_id === friendId) ||
      (f.friend_id === user.id && f.user_id === friendId),
  );
  if (!isFriend) return null;

  const { data: friend } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', friendId)
    .single<Profile>();

  if (!friend) return null;

  const netCents = await getFriendBalance(friendId);
  return { friend, netCents };
}
