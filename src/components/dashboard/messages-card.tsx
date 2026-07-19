import Link from 'next/link';

import { MessagesSquare } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { previewLine } from '@/lib/dm';
import type { DmConversation } from '@/types/dto';
import { cn } from '@/utils/cn';

/**
 * Dashboard "Messages" panel (Server-rendered) — the home-page entry point into direct
 * messages. Shows the few most recent conversations with unread badges and links into
 * the full /messages surface. When there are none, it invites the user to start one.
 * Kept read-only/link-only so the dashboard stays a Server Component; the interactive
 * "New message" picker lives on /messages itself.
 */
export function MessagesCard({
  conversations,
  unreadTotal,
}: {
  conversations: DmConversation[];
  unreadTotal: number;
}) {
  const preview = conversations.slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessagesSquare className="h-4 w-4 text-primary" />
          Messages
          {unreadTotal > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
              {unreadTotal > 9 ? '9+' : unreadTotal} new
            </span>
          ) : null}
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.messages}>Open messages</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {preview.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/25 [&_svg]:h-7 [&_svg]:w-7">
              <MessagesSquare />
            </span>
            <div>
              <p className="font-semibold">No conversations yet</p>
              <p className="text-sm text-muted-foreground">
                Message a friend who’s on the app — chats sync live on both sides.
              </p>
            </div>
            <Button asChild variant="gradient" size="sm">
              <Link href={ROUTES.messages}>Start a conversation</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {preview.map((c) => {
              const unread = c.unreadCount > 0;
              return (
                <li key={c.threadId}>
                  <Link
                    href={`${ROUTES.messageThread}/${c.threadId}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <Avatar name={c.otherName} className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm',
                          unread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {c.otherName}
                      </span>
                      <span
                        className={cn(
                          'block truncate text-xs',
                          unread ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {previewLine(c)}
                      </span>
                    </span>
                    {unread ? (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
