'use client';

import * as React from 'react';

/**
 * Track whether a CSS media query currently matches. SSR-safe: returns `false`
 * on the server and the first client render, then syncs to the real value after
 * mount (so it never reads `window` during render). Used by the app shell to
 * switch between the desktop sidebar and the mobile drawer.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
