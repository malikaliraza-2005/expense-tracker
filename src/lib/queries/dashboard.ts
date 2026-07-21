import { getUser } from '@/lib/auth';
import { listCategories } from '@/lib/queries/categories';
import {
  fetchSettlementStatus,
  shapeExpenseList,
} from '@/lib/queries/expenses';
import { createClient } from '@/lib/supabase/server';
import type { DashboardData } from '@/types/dto';
import type { Expense } from '@/types/db';

/**
 * Dashboard read. Assembles the home overview from every expense the user is part of:
 * outstanding vs settled totals, a recent list of outstanding expenses, and a category
 * spend breakdown for the insights donut. Returns `null` when unauthenticated.
 *
 * Scope note: this reflects expenses the user OWNS **plus** ones shared with them as a
 * participant — the same RLS-scoped set the expenses list returns. An expense someone
 * else added you to is money you're involved in, so leaving it out of the home totals
 * would understate what you owe.
 *
 * Cost note: the headline totals only need each expense's amount, date, category, and
 * settled state — NOT its payer, participant count, or "added by" name. So this fetches
 * the raw rows plus one settlement-status read (both needed for a correct outstanding vs
 * settled split) and computes the aggregates directly, then does the expensive per-row
 * shaping (payer / participant / owner-name lookups) for ONLY the five recent items it
 * actually displays — instead of shaping the entire history just to show five rows.
 */

/** How many recent outstanding expenses the dashboard surfaces. */
const RECENT_LIMIT = 5;

export async function getDashboard(): Promise<DashboardData | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = createClient();

  // Raw expenses, newest first — RLS scopes them to the caller (own + shared).
  const { data: rows } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
  const expenses = (rows ?? []) as Expense[];

  if (expenses.length === 0) {
    return {
      outstandingCents: 0,
      settledCents: 0,
      outstandingCount: 0,
      settledCount: 0,
      recentOutstanding: [],
      categoryBreakdown: [],
      totalSpendCents: 0,
      monthlySpendCents: 0,
      expenseCount: 0,
    };
  }

  // Category metadata (name/icon) for the breakdown, and payment-derived settled
  // status for the outstanding/settled split — the two reads the totals need.
  // Both are cheap: categories is request-cached, and the status is a single RPC.
  const [categories, statusById] = await Promise.all([
    listCategories(),
    fetchSettlementStatus(expenses.map((expense) => expense.id)),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Effective settled state: manually marked (migration 0011) OR fully covered by
  // payments (migration 0031), so a balance the other account has paid off drops out
  // of "outstanding" here too.
  const isFullySettled = (expense: Expense): boolean =>
    Boolean(expense.settled_at) ||
    Boolean(statusById.get(expense.id)?.fullySettled);

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const byCategory = new Map<
    string,
    { name: string; icon: string; totalCents: number }
  >();
  let outstandingCents = 0;
  let settledCents = 0;
  let outstandingCount = 0;
  let settledCount = 0;
  let totalSpendCents = 0;
  let monthlySpendCents = 0;
  const recentOutstandingRaw: Expense[] = [];

  for (const expense of expenses) {
    const settled = isFullySettled(expense);
    if (settled) {
      settledCents += expense.amount_cents;
      settledCount += 1;
    } else {
      outstandingCents += expense.amount_cents;
      outstandingCount += 1;
      // Rows are already newest-first, so the first five outstanding ARE the
      // recent ones — collect their raw rows to shape below.
      if (recentOutstandingRaw.length < RECENT_LIMIT) {
        recentOutstandingRaw.push(expense);
      }
    }

    totalSpendCents += expense.amount_cents;
    if (expense.expense_date?.startsWith(monthPrefix)) {
      monthlySpendCents += expense.amount_cents;
    }

    const category = categoryById.get(expense.category_id);
    if (category) {
      const existing = byCategory.get(category.name);
      if (existing) {
        existing.totalCents += expense.amount_cents;
      } else {
        byCategory.set(category.name, {
          name: category.name,
          icon: category.icon,
          totalCents: expense.amount_cents,
        });
      }
    }
  }

  const categoryBreakdown = Array.from(byCategory.values()).sort(
    (a, b) => b.totalCents - a.totalCents,
  );

  // Full per-row shaping (payer, participant count, "added by") for the five rows
  // we actually render — not the whole history.
  const recentOutstanding = await shapeExpenseList(recentOutstandingRaw);

  return {
    outstandingCents,
    settledCents,
    outstandingCount,
    settledCount,
    recentOutstanding,
    categoryBreakdown,
    totalSpendCents,
    monthlySpendCents,
    expenseCount: expenses.length,
  };
}
