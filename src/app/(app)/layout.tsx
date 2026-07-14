/**
 * Protected app shell layout.
 *
 * Phase 0: renders a plain shell container only — NO auth guard, sidebar, or
 * nav yet. Route protection is added in Phase 1; navigation chrome in later
 * phases.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
