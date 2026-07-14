import Link from 'next/link';

import { Users } from 'lucide-react';

import { BalanceLabel } from '@/components/common/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import type { GroupWithBalance } from '@/types/dto';

/**
 * Dashboard "Your groups" overview (presentational, Server-rendered). Each group
 * links to its detail page and shows the current user's net within it (reused
 * from the balance engine via the groups read). Empty until a group exists.
 */
export function GroupsOverview({ groups }: { groups: GroupWithBalance[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Your groups</CardTitle>
        {groups.length > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.groups}>View all</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re not in any groups yet — create one to split shared costs.
          </p>
        ) : (
          <ul className="space-y-2">
            {groups.map(({ group, memberCount, netCents }) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
                      <Users />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{group.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {memberCount}{' '}
                        {memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    <BalanceLabel netCents={netCents} subject="you" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
