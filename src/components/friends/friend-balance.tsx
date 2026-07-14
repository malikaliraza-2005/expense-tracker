import { BalanceLabel } from '@/components/common/money';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FriendBalanceDetail } from '@/types/dto';

/**
 * Balance-with-a-friend panel (presentational, Server-rendered). Shows the net
 * between the current user and one friend. The itemized who-paid-what breakdown
 * fills in once expenses exist (Phase 4); until then the net is the whole story.
 */
export function FriendBalance({ detail }: { detail: FriendBalanceDetail }) {
  const name = detail.friend.full_name || 'Unnamed';

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <Avatar name={detail.friend.full_name} className="h-11 w-11 text-sm" />
        <div className="space-y-1">
          <CardTitle className="text-lg">{name}</CardTitle>
          <BalanceLabel netCents={detail.netCents} subject="them" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {detail.netCents === 0
            ? 'You are all settled up with this friend.'
            : 'A detailed breakdown of shared expenses appears here once you record them.'}
        </p>
      </CardContent>
    </Card>
  );
}
