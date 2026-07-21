'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';

/**
 * Activity Server Actions. Reads live in `lib/queries/activity.ts`; the only write
 * from the UI is marking the feed read. Owner-scoped RLS (`owner_id = auth.uid()`) is
 * the authorization backstop.
 */

/** Mark all of the current user's unread activity as read (clears the badge). */
export async function markActivityRead(): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { error } = await supabase
    .from('activity_events')
    .update({ read_at: new Date().toISOString() })
    .eq('owner_id', user.id)
    .is('read_at', null);
  if (error) return { ok: false, error: 'Something went wrong. Please try again.' };

  // Refresh the shell so the entry-point badge updates.
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}
