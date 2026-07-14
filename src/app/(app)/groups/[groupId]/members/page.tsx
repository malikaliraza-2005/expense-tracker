import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Group members' };

/** Group members placeholder (Phase 0). Built in Phase 3. */
export default function GroupMembersPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Group members</h1>
      <p className="text-sm text-muted-foreground">
        Member management arrives in Phase 3.
      </p>
    </section>
  );
}
