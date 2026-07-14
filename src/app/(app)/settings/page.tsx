import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

/** Settings placeholder (Phase 0). Built in later phases. */
export default function SettingsPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted-foreground">
        Settings arrive in a later phase.
      </p>
    </section>
  );
}
