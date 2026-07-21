'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { markActivityRead } from '@/actions/activity';

/**
 * Clears the unread badge when the Activity page is viewed. Runs once on mount:
 * marks the current user's unread events read, then refreshes so the header badge
 * updates. Renders nothing. Only fires when there's something unread, to avoid a
 * needless write on every visit.
 */
export function MarkReadOnView({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();

  React.useEffect(() => {
    if (!hasUnread) return;
    let active = true;
    markActivityRead().then((res) => {
      if (active && res.ok) router.refresh();
    });
    return () => {
      active = false;
    };
    // Run once per mount; hasUnread reflects the server snapshot at load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
