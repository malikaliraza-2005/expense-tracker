'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

/**
 * App-wide direct-message sync. Mounted once in the protected shell (beside
 * {@link RealtimeSync}), it keeps the header inbox badge — and the conversation list —
 * live on EVERY page, not just the messages screen: a message received while the user
 * is on the dashboard, an expense, anywhere, lights the inbox indicator immediately.
 *
 * DMs are kept out of the general {@link RealtimeSync} table set on purpose, but the
 * unread badge lives in the app shell (a layout Next.js preserves across navigations),
 * so it has no other way to update live. This is that trigger. It subscribes to:
 *   - `dm_messages` inserts — a new message arrives → badge appears / count rises;
 *   - `dm_threads` inserts — a brand-new conversation shows up in the list;
 *   - `dm_reads` changes — the user reads a thread (here or on another device) → the
 *     badge clears, since the shell won't recompute the count on a plain navigation.
 *
 * RLS scopes delivery to the viewer's own rows, so a refresh only fires when a change
 * actually concerns them. `router.refresh()` re-runs the shell's server components,
 * re-deriving the exact unread count — one source of truth, no client-side drift.
 * Bursts are debounced into a single refresh.
 */
const DEBOUNCE_MS = 300;

export function DmRealtime() {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel('dm-sync')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dm_messages' },
          refreshSoon,
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dm_threads' },
          refreshSoon,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dm_reads' },
          refreshSoon,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
