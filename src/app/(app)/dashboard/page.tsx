import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

/** Dashboard placeholder (Phase 0). Built in Phase 5. */
export default function DashboardPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Overview and balances arrive in Phase 5.
      </p>
    </section>
  );
}
