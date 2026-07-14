import { HandCoins } from 'lucide-react';

import { Money } from '@/components/common/money';
import type { SettlementListItem } from '@/types/dto';
import { formatDate } from '@/utils/date';

/**
 * Settlement history list (presentational, Server-rendered). Renders each
 * recorded transfer as a directional sentence from the current user's
 * perspective — "You paid X" / "X paid you" — falling back to "A paid B" for
 * third-party rows visible via a shared group. Reused by the dashboard and the
 * friend / group balance views.
 */
export function SettlementList({
  settlements,
  currentUserId,
}: {
  settlements: SettlementListItem[];
  currentUserId: string;
}) {
  return (
    <ul className="space-y-2">
      {settlements.map(({ settlement, payer, receiver }) => {
        const payerName =
          payer.id === currentUserId ? 'You' : payer.full_name || 'Someone';
        const receiverName =
          receiver.id === currentUserId
            ? 'you'
            : receiver.full_name || 'someone';

        return (
          <li
            key={settlement.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
              <HandCoins />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {payerName} paid {receiverName}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {formatDate(settlement.settled_at)}
                {settlement.note ? ` · ${settlement.note}` : ''}
              </p>
            </div>
            <Money
              cents={settlement.amount_cents}
              className="shrink-0 font-medium"
            />
          </li>
        );
      })}
    </ul>
  );
}
