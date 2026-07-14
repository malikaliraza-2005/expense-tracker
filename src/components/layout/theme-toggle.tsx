'use client';

import * as React from 'react';

import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Light/dark theme toggle (Phase 6, optional). Flips the `dark` class on the
 * document root and persists the choice to `localStorage`; the no-FOUC script in
 * the root layout applies that stored choice before first paint. Kept
 * dependency-free (no next-themes) to match the project's minimal-deps stance.
 *
 * Renders nothing until mounted so the button's icon matches the real theme and
 * never mismatches during hydration.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // Private mode / storage disabled — the class still applies for this session.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={mounted && isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {mounted && isDark ? <Moon /> : <Sun />}
    </Button>
  );
}
