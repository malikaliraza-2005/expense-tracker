'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  LayoutDashboard,
  Receipt,
  Search,
  User,
  Users,
} from 'lucide-react';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/** Primary navigation, shared by the desktop sidebar and the mobile drawer. */
export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { href: ROUTES.expenses, label: 'Expenses', icon: Receipt },
  { href: ROUTES.friends, label: 'Friends', icon: User },
  { href: ROUTES.groups, label: 'Groups', icon: Users },
  { href: ROUTES.search, label: 'Search', icon: Search },
];

/** True when `href` is the current section (exact, or a nested route under it). */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Vertical list of nav links with an active-section highlight. `onNavigate`
 * lets the mobile drawer close itself when a link is tapped.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-accent text-accent-foreground shadow-soft'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                active ? 'text-primary' : '',
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
