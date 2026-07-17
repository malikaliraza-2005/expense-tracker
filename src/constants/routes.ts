/** Centralized route map. Keeps navigation and redirects consistent. */

export const ROUTES = {
  // Public (auth) routes
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  authCallback: '/auth/callback',
  /** Public invite accept page; append `/<token>`. */
  invite: '/invite',

  // Protected (app) routes
  dashboard: '/dashboard',
  expenses: '/expenses',
  newExpense: '/expenses/new',
  /** Phase 4 — Friends page (add by email/link, running balances, settle-up). */
  friends: '/friends',
  /** Phase 5 — Requests page (Sent / Received / Accepted / Rejected). */
  requests: '/requests',
  /** Restored — Groups page (organise shared expenses; per-expense chat lives on
   * Expense Detail, not a standalone route). */
  groups: '/groups',
  /** Activity feed — chronological history of everything involving the user. */
  activity: '/activity',
  // Retired in Phase 2 — redirects to /expenses (see next.config.mjs). Kept as a
  // constant so the redirect source and any lingering references resolve.
  members: '/members',
  profile: '/profile',
  settings: '/settings',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
