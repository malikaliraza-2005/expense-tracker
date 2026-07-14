import { SettlementList } from '@/components/settlements/settlement-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SettlementListItem } from '@/types/dto';

/**
 * Dashboard "Recent settlements" panel (presentational, Server-rendered). Reuses
 * the {@link SettlementList} for the rows. Empty until a payment is recorded.
 */
export function RecentSettlements({
  settlements,
  currentUserId,
}: {
  settlements: SettlementListItem[];
  currentUserId: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent settlements</CardTitle>
      </CardHeader>
      <CardContent>
        {settlements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No settlements yet — record one from a friend or group to clear a
            balance.
          </p>
        ) : (
          <SettlementList
            settlements={settlements}
            currentUserId={currentUserId}
          />
        )}
      </CardContent>
    </Card>
  );
}
