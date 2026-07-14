import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Expenses' };

/** Expenses list placeholder (Phase 0). Built in Phase 4. */
export default function ExpensesPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
      <p className="text-sm text-muted-foreground">
        Expense tracking arrives in Phase 4.
      </p>
    </section>
  );
}
