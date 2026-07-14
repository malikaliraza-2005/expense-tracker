import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Groups' };

/** Groups list placeholder (Phase 0). Built in Phase 3. */
export default function GroupsPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
      <p className="text-sm text-muted-foreground">
        Groups arrive in Phase 3.
      </p>
    </section>
  );
}
