import type { Metadata } from 'next';

import { Check, Clock, Users } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { BalanceLabel } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { AddFriendDialog } from '@/components/friends/add-friend-dialog';
import { FriendRowActions } from '@/components/friends/friend-row-actions';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import type { FriendStatus } from '@/lib/friends';
import { getSelfMemberId } from '@/lib/queries/balances';
import { getFriends } from '@/lib/queries/friends';

export const metadata: Metadata = { title: 'Friends' };

/**
 * Friends page (Phase 4). Lists the owner's members who are linked to a real
 * account or reachable by email — each with a running balance and, where relevant,
 * a settle-up or invite action. Adding a friend by email routes to an in-app
 * request (if they already have an account) or an email invite (if not); adding by
 * link mints a shareable `/invite/<token>`. A friend is just a member linked to an
 * account, so nothing here duplicates People — it reuses the same rails.
 */
export default async function FriendsPage() {
  await requireUser();
  const [friends, selfMemberId] = await Promise.all([
    getFriends(),
    getSelfMemberId(),
  ]);

  const header = (
    <PageHeader
      eyebrow="People"
      title="Friends"
      description="People you split with who are on the app, or you can invite."
      action={<AddFriendDialog />}
    />
  );

  if (friends.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <EmptyState
          icon={<Users />}
          title="No friends yet"
          description="Add a friend by email to send them a request or an invite, and keep a running balance with them."
          action={<AddFriendDialog />}
        />
      </section>
    );
  }

  const linkedCount = friends.filter((f) => f.status === 'linked').length;

  return (
    <section className="space-y-6">
      {header}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Friends
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {friends.length}
            </span>
          </CardTitle>
          {linkedCount > 0 ? (
            <span className="text-sm text-muted-foreground">
              {linkedCount} on the app
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border/50">
            {friends.map((friend) => {
              const { member } = friend;
              return (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.name} className="h-9 w-9" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {member.name}
                        </span>
                        <StatusBadge status={friend.status} />
                      </span>
                      {member.email ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      ) : null}
                      <BalanceLabel
                        netCents={friend.netCents}
                        subject="them"
                        className="mt-0.5 block"
                      />
                    </span>
                  </span>
                  <FriendRowActions
                    status={friend.status}
                    selfMemberId={selfMemberId}
                    memberId={member.id}
                    memberName={member.name}
                    email={member.email}
                    netCents={friend.netCents}
                  />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

/** A small pill marking where a friend sits on the account-linking journey. */
function StatusBadge({ status }: { status: FriendStatus }) {
  if (status === 'linked') {
    return (
      <Badge variant="success">
        <Check className="h-3 w-3" />
        Friend
      </Badge>
    );
  }
  if (status === 'invited') {
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3" />
        Invited
      </Badge>
    );
  }
  return null;
}
