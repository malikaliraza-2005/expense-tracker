import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { ROUTES } from '@/constants/routes';
import type { Database } from '@/types/database.types';

/**
 * Refresh the Supabase session on every matched request, keep the auth cookies
 * in sync between request and response, and enforce route protection (Phase 1):
 *
 * - Unauthenticated request to a protected route  → redirect to /login.
 * - Authenticated request to an auth route         → redirect to /dashboard.
 *
 * RLS remains the ultimate authorization boundary; this is the routing-level
 * guard and session refresh.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are required. Copy .env.example to .env.local.',
    );
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the user to refresh the session cookie. Do not run logic between
  // client creation and this call (per @supabase/ssr guidance).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === ROUTES.login || pathname === ROUTES.register;
  // Public = the auth pages, the marketing home, and the auth callback handler.
  const isPublicRoute =
    isAuthRoute || pathname === '/' || pathname.startsWith('/auth');

  if (!user && !isPublicRoute) {
    return redirectPreservingCookies(request, ROUTES.login, supabaseResponse);
  }

  if (user && isAuthRoute) {
    return redirectPreservingCookies(request, ROUTES.dashboard, supabaseResponse);
  }

  return supabaseResponse;
}

/**
 * Build a redirect response that carries over the refreshed auth cookies from
 * the session response, so the redirected request stays authenticated.
 */
function redirectPreservingCookies(
  request: NextRequest,
  pathname: string,
  sessionResponse: NextResponse,
): NextResponse {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = '';

  const response = NextResponse.redirect(redirectUrl);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}
