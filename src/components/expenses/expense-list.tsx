import Link from 'next/link';

import { Check, ChevronRight } from 'lucide-react';

import { LocalDate } from '@/components/common/local-date';
import { Money } from '@/components/common/money';
import { categoryIcon, colorForKey } from '@/constants/categories';
import type { ExpenseListItem } from '@/types/dto';
import { cn } from '@/utils/cn';

/**
 * Expense list (presentational). Each expense is a tappable neon row linking to its
 * detail view — a colour-coded category glyph, the title, meta line (payer · date ·
 * people), and the total. Rows lift and glow on hover.
 *
 * A list can mix the reader's own expenses with ones shared with them, so a shared row
 * is tagged with who added it — otherwise the two are indistinguishable.
 */
export function ExpenseList({
  expenses,
  currentUserId,
}: {
  expenses: ExpenseListItem[];
  /** The viewing user's id; used to label the payer "You" from the reader's view. */
  currentUserId?: string;
}) {
  return (
    <ul className="space-y-2">
      {expenses.map(({ expense, category, payer, participantCount, isOwn, addedByName, fullySettled }) => {
        const Icon = categoryIcon(category.icon);
        const color = colorForKey(category.icon || category.name);
        // "You" is the reader's own member: their claimed member (linked_user_id),
        // or their self-member on an expense they own. On a shared expense the
        // owner's self-member is NOT the reader, so it must not read as "You".
        const payerIsMe =
          (currentUserId != null && payer.linked_user_id === currentUserId) ||
          (expense.owner_id === currentUserId && payer.is_self);
        const payerName = payerIsMe ? 'You' : payer.name;
        // Manual flag OR fully paid off (migration 0031) — reads the same on every
        // account the expense is shared with.
        const settled = fullySettled;
        return (
          <li key={expense.id}>
            <Link
              href={`/expenses/${expense.id}`}
              className={cn(
                'group flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 p-3 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40 hover:shadow-glow-sm focus-visible:ring-2 focus-visible:ring-ring',
                settled && 'opacity-70',
              )}
            >
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-200 group-hover:scale-110 [&_svg]:h-5 [&_svg]:w-5"
                style={{
                  backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                  color,
                  borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                }}
              >
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {settled ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-income" />
                  ) : null}
                  <span className="truncate">{expense.title}</span>
                  {/* Shared with the reader — say whose it is, or the row is
                      indistinguishable from their own. */}
                  {!isOwn && addedByName ? (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      added by {addedByName}
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {payerName} paid ·{' '}
                  <LocalDate value={expense.expense_date} />
                  {participantCount > 0
                    ? ` · ${participantCount} ${participantCount === 1 ? 'person' : 'people'}`
                    : ''}
                </p>
              </div>
              <Money
                cents={expense.amount_cents}
                className="shrink-0 font-semibold tabular-nums"
              />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
