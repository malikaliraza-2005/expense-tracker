import type { Metadata } from 'next';

import { Users } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { AddFriendDialog } from '@/components/friends/add-friend-dialog';
import { FriendList } from '@/components/friends/friend-list';
import { getFriends } from '@/lib/queries/friends';

export const metadata: Metadata = { title: 'Friends' };

/**
 * Friends page (Phase 3). Server Component: reads the RLS-scoped friends list
 * with per-friend balances and renders the add dialog plus the interactive list.
 */
export default async function FriendsPage() {
  const friends = await getFriends();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Friends"
        description="People you split expenses with."
        action={<AddFriendDialog />}
      />

      {friends.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No friends yet"
          description="Add a friend by email to start sharing expenses. Friends must already have an account."
          action={<AddFriendDialog />}
        />
      ) : (
        <FriendList friends={friends} />
      )}
    </section>
  );
}
