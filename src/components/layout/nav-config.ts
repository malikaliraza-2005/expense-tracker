import type { LucideIcon } from 'lucide-react';

import { LayoutDashboard, Receipt, Settings, User } from 'lucide-react';

import { ROUTES } from '@/constants/routes';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Primary navigation shown in the mobile bottom bar and the desktop top bar.
 * The app is expense-first: two focused destinations flank the central "Add"
 * action; the account entries live in the avatar menu.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: ROUTES.dashboard, label: 'Home', icon: LayoutDashboard },
  { href: ROUTES.expenses, label: 'Expenses', icon: Receipt },
];

/** Secondary destinations surfaced in the avatar / account menu. */
export const ACCOUNT_NAV: NavItem[] = [
  { href: ROUTES.profile, label: 'Profile', icon: User },
  { href: ROUTES.settings, label: 'Settings', icon: Settings },
];

/** True when `href` is the active section (exact match or a nested route). */
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
