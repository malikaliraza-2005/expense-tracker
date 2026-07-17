'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

/**
 * App-wide real-time sync. Mounted once in the protected shell, it subscribes to
 * Postgres changes on every sync-relevant table and refreshes the current route when
 * anything the user can see changes — so balances, lists, groups, members, and the
 * activity feed stay live across accounts without a manual refresh.
 *
 * RLS scopes the stream: a client only receives changes for rows it can already
 * SELECT (its own data plus what 0015 cross-user visibility exposes), so User B is
 * refreshed exactly when a change actually affects them — e.g. User A adding them to
 * an expense or recording a settlement — and never for unrelated activity.
 *
 * `router.refresh()` re-runs the Server Components (re-deriving balances on read)
 * while preserving client state, so nothing flickers or resets. Bursts (an expense
 * insert plus its split rows) are debounced into a single refresh.
 */
const SYNC_TABLES = [
  'expenses',
  'expense_splits',
  'settlements',
  'groups',
  'group_members',
  'members',
  'invitations',
  'activity_events',
] as const;

const DEBOUNCE_MS = 300;

export function RealtimeSync() {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      let channelBuilder = supabase.channel('app-sync');
      for (const table of SYNC_TABLES) {
        channelBuilder = channelBuilder.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          scheduleRefresh,
        );
      }
      channel = channelBuilder.subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
