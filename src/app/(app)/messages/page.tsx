import type { Metadata } from 'next';
import Link from 'next/link';

import { MessagesSquare } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { LocalDate } from '@/components/common/local-date';
import { PageHeader } from '@/components/common/page-header';
import { StartDmDialog } from '@/components/messages/start-dm-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { previewLine } from '@/lib/dm';
import { getConversations, getDmCandidates } from '@/lib/queries/dm';
import { cn } from '@/utils/cn';

export const metadata: Metadata = { title: 'Messages' };

/**
 * Messages (Phase 1 — direct messages). Lists the user's one-to-one conversations,
 * newest-activity first, each with a last-message preview and an unread count. "New
 * message" opens a DM with any connected account (a friend who's on the app). A DM is
 * only possible between connected accounts, so nothing here can reach a stranger.
 *
 * The list stays live via the app-wide {@link DmRealtime} listener in the shell — the
 * same one that keeps the header inbox badge current on every page.
 */
export default async function MessagesPage() {
  await requireUser();
  const [conversations, candidates] = await Promise.all([
    getConversations(),
    getDmCandidates(),
  ]);

  const header = (
    <PageHeader
      eyebrow="Direct messages"
      title="Messages"
      description="Your one-to-one conversations with friends on the app."
      action={<StartDmDialog candidates={candidates} />}
    />
  );

  if (conversations.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <EmptyState
          icon={<MessagesSquare />}
          title="No conversations yet"
          description="Start a direct message with a friend who’s on the app. Your chats stay in sync across both of your devices in real time."
          action={<StartDmDialog candidates={candidates} />}
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {header}
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border/50">
            {conversations.map((c) => {
              const unread = c.unreadCount > 0;
              return (
                <li key={c.threadId}>
                  <Link
                    href={`${ROUTES.messageThread}/${c.threadId}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <Avatar name={c.otherName} className="h-10 w-10" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-sm',
                            unread ? 'font-semibold' : 'font-medium',
                          )}
                        >
                          {c.otherName}
                        </span>
                        {c.lastAt ? (
                          <LocalDate
                            value={c.lastAt}
                            className="shrink-0 text-[11px] text-muted-foreground"
                          />
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-xs',
                            unread
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {previewLine(c)}
                        </span>
                        {unread ? (
                          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                            {c.unreadCount > 9 ? '9+' : c.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
