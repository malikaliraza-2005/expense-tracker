import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Expense' };

/** Expense detail placeholder (Phase 0). Built in Phase 4. */
export default function ExpenseDetailPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Expense detail</h1>
      <p className="text-sm text-muted-foreground">
        Expense details arrive in Phase 4.
      </p>
    </section>
  );
}
