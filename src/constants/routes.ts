/** Centralized route map. Keeps navigation and redirects consistent. */

export const ROUTES = {
  // Public (auth) routes
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  authCallback: '/auth/callback',

  // Protected (app) routes
  dashboard: '/dashboard',
  expenses: '/expenses',
  newExpense: '/expenses/new',
  profile: '/profile',
  settings: '/settings',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
