import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Friends' };

/** Friends list placeholder (Phase 0). Built in Phase 3. */
export default function FriendsPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
      <p className="text-sm text-muted-foreground">
        Friends arrive in Phase 3.
      </p>
    </section>
  );
}
