import { NextResponse, type NextRequest } from 'next/server';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth callback route (Phase 1).
 *
 * Handles the redirect from Supabase email-confirmation / magic links: it
 * exchanges the one-time `code` for a session cookie via the SSR client, then
 * forwards the user to their destination. On any failure it returns to login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? ROUTES.dashboard;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}${ROUTES.login}?error=auth`);
}
