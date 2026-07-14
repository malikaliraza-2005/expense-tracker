import Link from 'next/link';

import { signOut } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';

/**
 * Protected app shell layout (Phase 1).
 *
 * Server-side auth guard: `requireUser` redirects unauthenticated visitors to
 * the login page (defense in depth alongside middleware). Provides a minimal
 * top bar with a logout control; richer navigation chrome arrives in later
 * phases.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={ROUTES.dashboard} className="font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <main className="container mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
