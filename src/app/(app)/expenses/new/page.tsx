import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New expense' };

/** New-expense placeholder (Phase 0). Built in Phase 4. */
export default function NewExpensePage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">New expense</h1>
      <p className="text-sm text-muted-foreground">
        The expense form and split editor arrive in Phase 4.
      </p>
    </section>
  );
}
