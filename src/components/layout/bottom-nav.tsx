'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Plus } from 'lucide-react';

import {
  PRIMARY_NAV,
  badgeLabel,
  isActiveRoute,
  type NavBadges,
} from '@/components/layout/nav-config';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * Fixed mobile bottom navigation (replaces the old sidebar). Four primary
 * destinations flank a prominent, elevated gradient "Add expense" action in the
 * centre — the Apple-Wallet / modern-fintech pattern. The active tab is marked
 * by a shared neon pill that animates between items with a spring
 * (`layoutId`), and by an icon-colour + label shift. Hidden on `md+`, where the
 * desktop top bar takes over.
 */
export function BottomNav({ badges }: { badges?: NavBadges }) {
  const pathname = usePathname();

  // Split the primary items evenly around the centre "Add" action.
  const mid = Math.ceil(PRIMARY_NAV.length / 2);
  const left = PRIMARY_NAV.slice(0, mid);
  const right = PRIMARY_NAV.slice(mid);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="glass-strong mx-3 mb-3 flex items-center justify-around gap-1 rounded-2xl px-2 py-2 shadow-elevated">
        {left.map((item) => (
          <NavTab
            key={item.href}
            item={item}
            active={isActiveRoute(pathname, item.href)}
            count={badges?.[item.href] ?? 0}
          />
        ))}

        <AddButton />

        {right.map((item) => (
          <NavTab
            key={item.href}
            item={item}
            active={isActiveRoute(pathname, item.href)}
            count={badges?.[item.href] ?? 0}
          />
        ))}
      </div>
    </nav>
  );
}

function NavTab({
  item,
  active,
  count,
}: {
  item: (typeof PRIMARY_NAV)[number];
  active: boolean;
  count: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className="group relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {active && (
        <span className="absolute inset-0 -z-10 rounded-xl bg-primary/12 ring-1 ring-inset ring-primary/25" />
      )}
      <span className="relative">
        <Icon
          className={cn(
            'h-5 w-5 transition-all duration-200 group-active:scale-90',
            active
              ? 'text-primary drop-shadow-[0_0_6px_hsl(var(--glow)/0.6)]'
              : 'text-muted-foreground group-hover:text-foreground',
          )}
        />
        {count > 0 ? (
          <span
            aria-label={`${count} awaiting you`}
            className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white shadow-glow-sm"
          >
            {badgeLabel(count)}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'w-full truncate text-center text-[10px] font-medium tracking-tight transition-colors',
          active ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

function AddButton() {
  return (
    <Link
      href={ROUTES.newExpense}
      aria-label="Add expense"
      className="group relative -mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-neon text-white shadow-glow outline-none transition-transform duration-200 ease-spring hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
    >
      <span className="absolute inset-0 rounded-2xl bg-gradient-neon opacity-60 blur-md transition-opacity group-hover:opacity-90" />
      <Plus className="relative h-6 w-6 transition-transform duration-300 group-hover:rotate-90" />
    </Link>
  );
}
