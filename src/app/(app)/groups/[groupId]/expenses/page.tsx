import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Group expenses' };

/** Group expenses placeholder (Phase 0). Built in Phase 4. */
export default function GroupExpensesPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Group expenses</h1>
      <p className="text-sm text-muted-foreground">
        Group expenses arrive in Phase 4.
      </p>
    </section>
  );
}
