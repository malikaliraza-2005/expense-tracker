import { getUser } from '@/lib/auth';
import { listExpenses } from '@/lib/queries/expenses';
import type { DashboardData } from '@/types/dto';

/**
 * Dashboard read. Assembles the home overview from every expense the user is part of:
 * outstanding vs settled totals, a recent list of outstanding expenses, and a category
 * spend breakdown for the insights donut. Returns `null` when unauthenticated.
 *
 * Scope note: this reflects expenses the user OWNS **plus** ones shared with them as a
 * participant — the same RLS-scoped set `listExpenses` returns. An expense someone else
 * added you to is money you're involved in, so leaving it out of the home totals would
 * understate what you owe.
 */

/** How many recent outstanding expenses the dashboard surfaces. */
const RECENT_LIMIT = 5;

export async function getDashboard(): Promise<DashboardData | null> {
  const user = await getUser();
  if (!user) return null;

  const expenses = await listExpenses();

  // Partition by the manual settled flag (migration 0011).
  const outstanding = expenses.filter((e) => !e.expense.settled_at);
  const settled = expenses.filter((e) => e.expense.settled_at);
  const outstandingCents = outstanding.reduce(
    (sum, e) => sum + e.expense.amount_cents,
    0,
  );
  const settledCents = settled.reduce(
    (sum, e) => sum + e.expense.amount_cents,
    0,
  );

  // Derive spend analytics from the already-fetched expense list (no extra
  // query). Category totals feed the dashboard donut; the monthly figure is a
  // simple current-calendar-month sum.
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const byCategory = new Map<
    string,
    { name: string; icon: string; totalCents: number }
  >();
  let totalSpendCents = 0;
  let monthlySpendCents = 0;

  for (const { expense, category } of expenses) {
    totalSpendCents += expense.amount_cents;
    if (expense.expense_date?.startsWith(monthPrefix)) {
      monthlySpendCents += expense.amount_cents;
    }
    const key = category.name;
    const existing = byCategory.get(key);
    if (existing) {
      existing.totalCents += expense.amount_cents;
    } else {
      byCategory.set(key, {
        name: category.name,
        icon: category.icon,
        totalCents: expense.amount_cents,
      });
    }
  }

  const categoryBreakdown = Array.from(byCategory.values()).sort(
    (a, b) => b.totalCents - a.totalCents,
  );

  return {
    outstandingCents,
    settledCents,
    outstandingCount: outstanding.length,
    settledCount: settled.length,
    recentOutstanding: outstanding.slice(0, RECENT_LIMIT),
    categoryBreakdown,
    totalSpendCents,
    monthlySpendCents,
    expenseCount: expenses.length,
  };
}
