import { getOverallSummary } from '@/lib/queries/balances';
import { listExpenses } from '@/lib/queries/expenses';
import { getGroups } from '@/lib/queries/groups';
import { listSettlements } from '@/lib/queries/settlements';
import { createClient } from '@/lib/supabase/server';
import type { DashboardData } from '@/types/dto';

/**
 * Dashboard read (Phase 5). Assembles the home overview by REUSING the existing
 * data-access layer rather than re-querying: the overall balance summary comes
 * from the balance engine (queries/balances.ts), and recent activity / group
 * figures from the Phase 3–4 expense, settlement, and group reads. Every figure
 * is therefore settlement-aware and reconciles with the ledger by construction.
 *
 * All the underlying reads are RLS-scoped, so the dashboard only ever reflects
 * data the caller may see. Returns `null` when unauthenticated.
 */

/** How many recent expenses / settlements the dashboard surfaces. */
const RECENT_LIMIT = 5;

export async function getDashboard(): Promise<DashboardData | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [summary, expenses, recentSettlements, groups] = await Promise.all([
    getOverallSummary(),
    listExpenses(),
    listSettlements({ limit: RECENT_LIMIT }),
    getGroups(),
  ]);

  return {
    summary,
    recentExpenses: expenses.slice(0, RECENT_LIMIT),
    recentSettlements,
    groups,
  };
}
