import { NextResponse, type NextRequest } from 'next/server';

/**
 * Auth callback route placeholder (Phase 0).
 *
 * In Phase 1 this exchanges the auth code for a session cookie via the SSR
 * Supabase client. For now it simply redirects to the app origin so the route
 * is valid and buildable.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(origin);
}
