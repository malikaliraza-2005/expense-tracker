import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New group' };

/** New-group placeholder (Phase 0). Built in Phase 3. */
export default function NewGroupPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">New group</h1>
      <p className="text-sm text-muted-foreground">
        Group creation arrives in Phase 3.
      </p>
    </section>
  );
}
