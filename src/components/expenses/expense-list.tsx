import Link from 'next/link';

import { Money } from '@/components/common/money';
import { Card } from '@/components/ui/card';
import { categoryIcon } from '@/constants/categories';
import type { ExpenseListItem } from '@/types/dto';
import { formatDate } from '@/utils/date';

/**
 * Expense list (presentational, Phase 4). Renders each expense as a card linking
 * to its detail view, showing the category glyph, title, date, payer, and total.
 * Empty and loading states are handled by the page/skeletons.
 */
export function ExpenseList({
  expenses,
  currentUserId,
}: {
  expenses: ExpenseListItem[];
  currentUserId: string;
}) {
  return (
    <ul className="space-y-2">
      {expenses.map(({ expense, category, payer, participantCount }) => {
        const Icon = categoryIcon(category.icon);
        const payerName =
          payer.id === currentUserId ? 'You' : payer.full_name || 'Someone';
        return (
          <li key={expense.id}>
            <Link
              href={`/expenses/${expense.id}`}
              className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/50">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
                  <Icon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{expense.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {payerName} paid · {formatDate(expense.expense_date)}
                    {participantCount > 0
                      ? ` · ${participantCount} ${participantCount === 1 ? 'person' : 'people'}`
                      : ''}
                  </p>
                </div>
                <Money
                  cents={expense.amount_cents}
                  className="shrink-0 font-medium"
                />
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
