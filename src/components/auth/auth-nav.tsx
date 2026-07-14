'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

/**
 * Top navigation bar for the public auth interface (login / register). Shows the
 * app name + logo on the left and the Login / Sign up switcher on the right,
 * highlighting whichever page is active. Presentation + navigation only — the
 * links point at the existing auth routes.
 */
export function AuthNav() {
  const pathname = usePathname();
  const onLogin = pathname === ROUTES.login;
  const onRegister = pathname === ROUTES.register;

  return (
    <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href={ROUTES.login}
          aria-label="Expense Tracker home"
          className="rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo size="sm" />
        </Link>

        <nav className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant={onLogin ? 'default' : 'ghost'}
            aria-current={onLogin ? 'page' : undefined}
          >
            <Link href={ROUTES.login}>Log in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={onRegister ? 'default' : 'outline'}
            aria-current={onRegister ? 'page' : undefined}
          >
            <Link href={ROUTES.register}>Sign up</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
