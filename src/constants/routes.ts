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
  // Retired in Phase 2 — both redirect to /expenses (see next.config.mjs). Kept
  // as constants so the redirect sources and any lingering references resolve.
  members: '/members',
  groups: '/groups',
  profile: '/profile',
  settings: '/settings',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
