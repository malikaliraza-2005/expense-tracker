import { cache } from 'react';

import { redirect } from 'next/navigation';

import type { User } from '@supabase/supabase-js';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side auth helpers (Phase 1).
 *
 * These read the authenticated user from the SSR Supabase client (cookie-based
 * session). Route protection is enforced primarily in middleware; these helpers
 * are the in-component/action complement (defense in depth) and the way Server
 * Components resolve the current user.
 */

/**
 * The current authenticated user, or `null`, wrapped in React `cache` so
 * repeated calls within one request share a single result.
 *
 * This reads the session from the request cookies (no network round-trip)
 * rather than calling `getUser()`, which would hit the Supabase Auth server on
 * every navigation. That is safe here because of two independent guarantees on
 * every protected request:
 *   1. Middleware (`updateSession`) has already called `getUser()` for real,
 *      verifying and refreshing the JWT before the page renders — a request
 *      that reaches a Server Component has a server-verified session.
 *   2. RLS is the ultimate boundary: every data query re-validates the JWT
 *      signature at the database, so a forged cookie yields no data regardless.
 * The result: one auth round-trip per navigation (in middleware) instead of two.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
});

/**
 * Require an authenticated user or redirect to the login page. Returns the user
 * for use by the caller when present.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect(ROUTES.login);
  return user;
}
