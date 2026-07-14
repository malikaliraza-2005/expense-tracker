import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Friend' };

/** Friend detail placeholder (Phase 0). Built in Phase 3. */
export default function FriendDetailPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Friend detail</h1>
      <p className="text-sm text-muted-foreground">
        Friend balances arrive in Phase 3.
      </p>
    </section>
  );
}
