import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database.types';

/**
 * Browser Supabase client for Client Components.
 * Uses only the public URL + anon key; RLS enforces access.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are required. Copy .env.example to .env.local.',
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
