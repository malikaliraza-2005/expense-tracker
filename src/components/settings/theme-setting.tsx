'use client';

import * as React from 'react';

import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '@/utils/cn';

type ThemeChoice = 'light' | 'dark' | 'system';

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Appearance control — a segmented Light / Dark / System selector. Mirrors the
 * no-FOUC script in the root layout: 'system' clears the stored choice (so the
 * OS preference wins), while 'light' / 'dark' persist an explicit choice. The
 * `dark` class on <html> is toggled immediately for a live preview.
 */
export function ThemeSetting() {
  const [choice, setChoice] = React.useState<ThemeChoice>('system');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      setChoice(stored === 'light' || stored === 'dark' ? stored : 'system');
    } catch {
      setChoice('system');
    }
    setMounted(true);
  }, []);

  function apply(next: ThemeChoice) {
    setChoice(next);
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = next === 'dark' || (next === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    try {
      if (next === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch {
      // Storage disabled — the class still applies for this session.
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">Theme</p>
        <p className="text-xs text-muted-foreground">
          Choose light, dark, or match your device.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-background/40 p-1"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = mounted && choice === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => apply(value)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-primary/15 text-primary shadow-glow-sm ring-1 ring-inset ring-primary/25'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
