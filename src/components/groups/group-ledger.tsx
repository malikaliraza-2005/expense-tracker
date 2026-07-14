import { ArrowRight } from 'lucide-react';

import { Money } from '@/components/common/money';
import type { GroupLedger as GroupLedgerData } from '@/types/dto';

/**
 * Group who-owes-whom ledger (presentational). Renders each directed debt from
 * the current user's perspective. Empty until the group has expenses (Phase 4).
 */
export function GroupLedger({ ledger }: { ledger: GroupLedgerData }) {
  if (ledger.entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No balances yet — they appear once expenses are added to this group.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {ledger.entries.map((entry, index) => (
        <li
          key={`${entry.from.id}-${entry.to.id}-${index}`}
          className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">
              {entry.from.full_name || 'Someone'}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">
              {entry.to.full_name || 'someone'}
            </span>
          </span>
          <Money cents={entry.amountCents} className="font-medium" />
        </li>
      ))}
    </ul>
  );
}
