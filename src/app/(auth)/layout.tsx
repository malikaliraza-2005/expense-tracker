/**
 * Public auth shell layout (login / register).
 *
 * Phase 0: centered container only — NO auth logic. Forms are wired in Phase 1.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
