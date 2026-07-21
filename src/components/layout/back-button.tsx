'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { ROUTES } from '@/constants/routes';
import { PRIMARY_NAV } from '@/components/layout/nav-config';

/** Nav roots — a back arrow here would step out of the app, so it isn't shown. */
const ROOTS: string[] = [...PRIMARY_NAV.map((item) => item.href), ROUTES.dashboard];

/**
 * Go back to the page you came from.
 *
 * Uses real history rather than a hardcoded parent, so it returns you to wherever you
 * actually were — Home → Activity → back lands on Home, not on some fixed "up" route
 * that guesses wrong.
 *
 * Two cases it has to survive:
 *   - **No history to go back to** (opened in a new tab, a shared deep link, a
 *     refresh): `router.back()` would either do nothing or leave the app entirely. We
 *     detect that and fall back to the dashboard.
 *   - **Nav roots** (Home, Expenses, Groups, …): there's nothing meaningful "back" from
 *     a top-level tab, so the arrow is hidden rather than dumping you out of the app.
 */
export function BackButton({ pathname }: { pathname: string }) {
  const router = useRouter();
  // History depth isn't readable during SSR, so assume we can go back until mounted;
  // this only ever downgrades the button to a dashboard link, never breaks it.
  const [canGoBack, setCanGoBack] = React.useState(true);

  React.useEffect(() => {
    // length <= 1 means this entry is the first in the tab's history: nothing of ours
    // to return to.
    setCanGoBack(window.history.length > 1);
  }, [pathname]);

  const isRoot = ROOTS.includes(pathname);
  if (isRoot) return null;

  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => (canGoBack ? router.back() : router.push(ROUTES.dashboard))}
      className="-ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9 [&_svg]:h-5 [&_svg]:w-5"
    >
      <ArrowLeft />
    </button>
  );
}
