import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/db';

/**
 * Profile reads (Phase 1). Part of the typed data-access layer — components and
 * actions call these instead of building Supabase queries inline. All reads are
 * RLS-scoped: a user can only ever read their own profile row.
 */

/**
 * The current user's profile, or `null` if unauthenticated or (transiently)
 * not yet created. Wrapped in React `cache` to dedupe within a request.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return null;
  return data;
});
