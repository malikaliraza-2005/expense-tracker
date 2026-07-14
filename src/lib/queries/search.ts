import { getFriends } from '@/lib/queries/friends';
import { getGroups } from '@/lib/queries/groups';
import type { FriendWithBalance, GroupWithBalance } from '@/types/dto';

/**
 * Search reads (Phase 6). Name search over the current user's friends and
 * groups. Both build on the existing RLS-scoped data-access helpers
 * (queries/friends.ts, queries/groups.ts) and filter their already-visible
 * results by name — so search can never surface a friend or group the caller
 * could not otherwise see, and the per-result balances come for free.
 *
 * The candidate sets (a user's own friends/groups) are small, so an in-memory
 * substring match is both sufficient and simplest; a blank query returns
 * nothing (an empty search box is not a request for everything).
 */

/** Case/whitespace-insensitive substring match. */
function matches(haystack: string | null | undefined, needle: string): boolean {
  return (haystack ?? '').toLowerCase().includes(needle);
}

/** Friends whose display name contains `query`, sorted as `getFriends` returns. */
export async function searchFriends(
  query: string,
): Promise<FriendWithBalance[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const friends = await getFriends();
  return friends.filter((friend) => matches(friend.profile.full_name, needle));
}

/** Groups whose name contains `query`, sorted as `getGroups` returns. */
export async function searchGroups(query: string): Promise<GroupWithBalance[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const groups = await getGroups();
  return groups.filter((group) => matches(group.group.name, needle));
}
