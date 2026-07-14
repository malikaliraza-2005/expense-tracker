import Link from 'next/link';

import { Users } from 'lucide-react';

import { BalanceLabel } from '@/components/common/money';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { groupTypeLabel } from '@/constants/group-types';
import type { GroupWithBalance } from '@/types/dto';

/**
 * Group summary card (presentational). Links to the group detail page and shows
 * the name, type badge, member count, and the current user's net within the
 * group.
 */
export function GroupCard({ group }: { group: GroupWithBalance }) {
  const { id, name, type } = group.group;

  return (
    <Link
      href={`/groups/${id}`}
      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors hover:bg-accent/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate text-lg">{name}</CardTitle>
            <Badge variant="secondary">{groupTypeLabel(type)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          </p>
          <BalanceLabel netCents={group.netCents} subject="you" />
        </CardContent>
      </Card>
    </Link>
  );
}
