import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Profile' };

/** Profile placeholder (Phase 0). Built in Phase 6. */
export default function ProfilePage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="text-sm text-muted-foreground">
        Profile management arrives in Phase 6.
      </p>
    </section>
  );
}
