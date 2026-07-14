import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Group' };

/** Group detail placeholder (Phase 0). Built in Phase 3. */
export default function GroupDetailPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Group detail</h1>
      <p className="text-sm text-muted-foreground">
        Group details arrive in Phase 3.
      </p>
    </section>
  );
}
