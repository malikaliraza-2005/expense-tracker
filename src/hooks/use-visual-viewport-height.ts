'use client';

import * as React from 'react';

/**
 * Keeps a self-contained mobile frame (e.g. a chat thread) anchored to the
 * *visible* viewport rather than the layout viewport.
 *
 * The problem it solves: `vh`/`dvh` do **not** shrink when the on-screen keyboard
 * opens. On iOS Safari the keyboard is an overlay that leaves the layout viewport
 * (and therefore `100dvh`) at full height, so anything pinned to the bottom of a
 * `100dvh` frame — like a chat composer — ends up hidden *behind* the keyboard and
 * the user has to scroll to reach it.
 *
 * `window.visualViewport` reports the region actually visible to the user (screen
 * minus browser chrome minus keyboard). We publish its height to a CSS variable
 * (`--visual-vh`) and flag when a keyboard is up (`--thread-chrome` drops the
 * bottom-nav clearance, since the nav is hidden behind the keyboard anyway). The
 * consuming CSS uses these with sensible fallbacks, so first paint and browsers
 * without `visualViewport` still get a reasonable `100dvh`-based height.
 *
 * Scoped to mobile: on `md+` the listeners never attach and no variables are set,
 * leaving the desktop layout exactly as it was.
 */
export function useVisualViewportHeight(): void {
  React.useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;

    // No visualViewport support (or SSR guard already passed): rely on the CSS
    // `100dvh` fallback and do nothing.
    if (!vv) return;

    const desktop = window.matchMedia('(min-width: 768px)');

    const clear = () => {
      root.style.removeProperty('--visual-vh');
      root.style.removeProperty('--thread-chrome');
    };

    const sync = () => {
      // Only drive the frame on mobile; desktop keeps its static `100dvh - 8rem`.
      if (desktop.matches) {
        clear();
        return;
      }

      root.style.setProperty('--visual-vh', `${Math.round(vv.height)}px`);

      // How much of the layout viewport the keyboard is covering. A meaningful
      // gap (> 120px) means the keyboard is open, so the bottom nav is hidden
      // behind it — drop its 5.5rem clearance and let the composer sit right
      // above the keyboard. Otherwise keep the full 11rem chrome allowance.
      const keyboardInset = window.innerHeight - vv.height - vv.offsetTop;
      root.style.setProperty(
        '--thread-chrome',
        keyboardInset > 120 ? '5.5rem' : '11rem',
      );
    };

    sync();
    // `resize` fires when the keyboard opens/closes or browser chrome changes;
    // `scroll` fires as iOS shifts the visual viewport to reveal a focused input.
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    desktop.addEventListener('change', sync);

    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      desktop.removeEventListener('change', sync);
      clear();
    };
  }, []);
}
