import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import type { Category } from '@/types/db';

/**
 * Category reads (Phase 2). Part of the typed data-access layer — components and
 * actions call these instead of building Supabase queries inline. Categories are
 * a static, seeded reference table readable by all authenticated users.
 */

/** All expense categories, ordered by id. Deduped within a request via cache. */
export const listCategories = cache(async (): Promise<Category[]> => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('id', { ascending: true });

  if (error || !data) return [];
  return data;
});
