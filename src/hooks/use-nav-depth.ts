'use client';

import * as React from 'react';

import {
  readDepth,
  resolveDepth,
  stampDepth,
} from '@/lib/nav-history';

/**
 * How many of OUR pages sit behind the current one in this tab's history. `0`
 * means the user entered the app here (a shared link, an invite email, a new
 * tab), so going back would leave the site — see `lib/nav-history` for why
 * `window.history.length` can't answer this.
 *
 * Numbers each entry as the router pushes it and reads the number back on
 * return. SSR-safe: it reports 0 until mounted and never reads `window` during
 * render, so the arrow degrades to a dashboard link for the frame before hydration
 * rather than risking a navigation out of the app.
 *
 * Takes `pathname` rather than calling `usePathname` itself so the caller's
 * existing subscription drives it, and so a route change re-syncs the depth.
 */
export function useNavDepth(pathname: string): number {
  const [depth, setDepth] = React.useState(0);
  // Refs, not state: a pushed entry is numbered from whatever we last saw, and
  // that bookkeeping must not itself trigger a render.
  const lastDepth = React.useRef(0);
  const entered = React.useRef(false);

  React.useEffect(() => {
    const sync = () => {
      const state = window.history.state as Record<string, unknown> | null;
      const value = resolveDepth(state, {
        entered: entered.current,
        lastDepth: lastDepth.current,
      });
      // Only stamp what the router just pushed; re-stamping a known entry would
      // rewrite history state on every back/forward for no gain.
      if (readDepth(state) === null) {
        window.history.replaceState(stampDepth(state, value), '');
      }
      entered.current = true;
      lastDepth.current = value;
      setDepth(value);
    };

    sync();
    // A back/forward between two entries that share a pathname (paging through
    // `/expenses?status=…`) doesn't re-run this effect, so catch it directly.
    // Re-running `sync` for a pop we already handled is harmless: the entry is
    // stamped by then, so it resolves to the same number.
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [pathname]);

  return depth;
}
