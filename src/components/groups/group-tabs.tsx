'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * In-group tab navigation: Overview / Expenses / Members / Balances. Each tab is
 * a real sub-route so it deep-links and its data loads scoped to the group. The
 * active tab is derived from the current path (exact match for Overview, prefix
 * for the rest).
 */
export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const base = `${ROUTES.groups}/${groupId}`;

  const tabs = [
    { href: base, label: 'Overview', exact: true },
    { href: `${base}/expenses`, label: 'Expenses', exact: false },
    { href: `${base}/members`, label: 'Members', exact: false },
    { href: `${base}/balances`, label: 'Balances', exact: false },
  ];

  return (
    <nav
      aria-label="Group sections"
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-border/50 pb-px"
    >
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative shrink-0 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
