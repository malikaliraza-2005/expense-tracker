import type { LucideIcon } from 'lucide-react';

import {
  Bell,
  Inbox,
  LayoutDashboard,
  Receipt,
  Settings,
  User,
  Users,
  Users2,
} from 'lucide-react';

import { ROUTES } from '@/constants/routes';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Primary navigation shown in the mobile bottom bar and the desktop top bar.
 * The app is expense-first: Home, Expenses, Groups, Friends, Requests, and Activity
 * surround the central "Add" action; the account entries live in the avatar menu.
 * (Groups was restored to organise shared expenses; Friends arrived in Phase 4,
 * Requests in Phase 5, Activity in the realtime/activity work. Chat is per-expense and
 * lives on Expense Detail, not in the nav.) Requests carries an actionable-received
 * badge and Activity an unread badge — see {@link NavBadges}.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: ROUTES.dashboard, label: 'Home', icon: LayoutDashboard },
  { href: ROUTES.expenses, label: 'Expenses', icon: Receipt },
  { href: ROUTES.groups, label: 'Groups', icon: Users2 },
  { href: ROUTES.friends, label: 'Friends', icon: Users },
  { href: ROUTES.requests, label: 'Requests', icon: Inbox },
  { href: ROUTES.activity, label: 'Activity', icon: Bell },
];

/**
 * Unread/actionable counts to overlay on nav items, keyed by `href`. The app
 * shell resolves these server-side once per navigation and threads them through
 * to the header and bottom bar; a missing or zero entry renders no badge.
 */
export type NavBadges = Partial<Record<string, number>>;

/** Secondary destinations surfaced in the avatar / account menu. */
export const ACCOUNT_NAV: NavItem[] = [
  { href: ROUTES.profile, label: 'Profile', icon: User },
  { href: ROUTES.settings, label: 'Settings', icon: Settings },
];

/** True when `href` is the active section (exact match or a nested route). */
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Compact badge label for a nav count, capping large values at "9+". */
export function badgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count);
}
