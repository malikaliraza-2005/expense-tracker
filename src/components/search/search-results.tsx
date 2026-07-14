import Link from 'next/link';

import { Users } from 'lucide-react';

import { BalanceLabel } from '@/components/common/money';
import { GroupCard } from '@/components/groups/group-card';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import type { FriendWithBalance, GroupWithBalance } from '@/types/dto';

/**
 * Search results (presentational). Renders a Friends section and a Groups
 * section for the current query, reusing the group card and the friend row look
 * from their respective lists. Handles the empty-query and no-results states so
 * the search page never dead-ends on a blank screen.
 */
export function SearchResults({
  query,
  friends,
  groups,
}: {
  query: string;
  friends: FriendWithBalance[];
  groups: GroupWithBalance[];
}) {
  if (!query.trim()) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Start typing to search your friends and groups.
      </p>
    );
  }

  if (friends.length === 0 && groups.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No friends or groups match “{query}”.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {friends.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Friends
          </h2>
          <ul className="space-y-2">
            {friends.map((friend) => {
              const name = friend.profile.full_name || 'Unnamed';
              return (
                <li key={friend.friendshipId}>
                  <Link
                    href={`/friends/${friend.profile.id}`}
                    className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/50">
                      <Avatar
                        name={friend.profile.full_name}
                        src={friend.profile.avatar_url}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name}</p>
                        <BalanceLabel
                          netCents={friend.netCents}
                          subject="them"
                        />
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {groups.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" />
            Groups
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <GroupCard key={group.group.id} group={group} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
