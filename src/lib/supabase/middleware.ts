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
  // Public = the auth pages, the forgot-password page, the marketing home, the
  // auth callback handler, member share links (read-only, no account), and the
  // invite accept page (signed-out invitees must reach it to register/log in).
  // (Reset-password stays protected: it needs the recovery session the callback
  // establishes.)
  const isPublicRoute =
    isAuthRoute ||
    pathname === ROUTES.forgotPassword ||
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/share') ||
    pathname.startsWith(ROUTES.invite);

  if (!user && !isPublicRoute) {
    // Preserve the intended destination so login can return the user to it
    // (e.g. a deep link into an expense). Same-origin relative path only.
    const next = pathname + request.nextUrl.search;
    const search = `?next=${encodeURIComponent(next)}`;
    return redirectPreservingCookies(request, ROUTES.login, supabaseResponse, search);
  }

  if (user && isAuthRoute) {
    // An already-signed-in user who opened an invite's "Create account" link
    // carries the invite `token` (register links use `?token=`, not `?next=`).
    // Route them to the invite page to claim it rather than silently dropping
    // the invite and bouncing to the dashboard (the old post-login dead end).
    const token = request.nextUrl.searchParams.get('token');
    if (token) {
      return redirectPreservingCookies(
        request,
        `${ROUTES.invite}/${encodeURIComponent(token)}`,
        supabaseResponse,
      );
    }
    // Otherwise honor a safe relative `next` (a deep link an already-signed-in
    // user opened) so they aren't bounced away from where they were headed.
    const next = safeNext(request.nextUrl.searchParams.get('next'));
    return redirectPreservingCookies(
      request,
      next ?? ROUTES.dashboard,
      supabaseResponse,
    );
  }

  return supabaseResponse;
}

/**
 * A same-origin relative path safe to redirect to, or null. Rejects absolute and
 * protocol-relative ("//host") URLs so `next` can't become an open redirect.
 */
function safeNext(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

/**
 * Build a redirect response that carries over the refreshed auth cookies from
 * the session response, so the redirected request stays authenticated. `target`
 * is a same-origin relative path that may include its own query string; its
 * `optionalSearch` (e.g. `?next=…`) is used only when the target has none.
 */
function redirectPreservingCookies(
  request: NextRequest,
  target: string,
  sessionResponse: NextResponse,
  optionalSearch = '',
): NextResponse {
  const [path, query] = target.split('?');
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = path;
  redirectUrl.search = query ? `?${query}` : optionalSearch;

  const response = NextResponse.redirect(redirectUrl);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}
