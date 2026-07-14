import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/types/database.types';

/**
 * Server Supabase client for Server Components, Server Actions, and Route
 * Handlers. Reads/writes the session from the request cookies so RLS runs
 * with the authenticated user's JWT.
 */
export function createClient() {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are required. Copy .env.example to .env.local.',
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` was called from a Server Component. This can be ignored
          // when middleware refreshes the session on each request.
        }
      },
    },
  });
}
