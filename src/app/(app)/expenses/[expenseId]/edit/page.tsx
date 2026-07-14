import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Edit expense' };

/** Edit-expense placeholder (Phase 0). Built in Phase 4. */
export default function EditExpensePage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Edit expense</h1>
      <p className="text-sm text-muted-foreground">
        Editing expenses arrives in Phase 4.
      </p>
    </section>
  );
}
