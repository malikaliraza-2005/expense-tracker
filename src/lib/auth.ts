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
 * The current authenticated user, or `null`. Uses `getUser()` (not
 * `getSession()`) so the JWT is verified against Supabase, and is wrapped in
 * React `cache` so repeated calls within one request hit the network once.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
