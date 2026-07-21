'use client';

import * as React from 'react';

import { Send } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteDirectMessageForEveryone,
  deleteDirectMessageForMe,
  markDmRead,
  sendDirectMessage,
} from '@/actions/dm';
import { MessageActions } from '@/components/chat/message-actions';
import { TypingIndicator } from '@/components/common/typing-indicator';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { useVisualViewportHeight } from '@/hooks/use-visual-viewport-height';
import {
  DELETED_MESSAGE_TEXT,
  isDeleted,
  mergeMessage,
  replaceMessage,
  sortMessages,
  upsertMessage,
} from '@/lib/chat';
import { isSendableBody, normalizeBody, toDirectMessage } from '@/lib/dm';
import { createClient } from '@/lib/supabase/client';
import type { DmMessage } from '@/types/db';
import type { DirectMessage, DmThreadData } from '@/types/dto';
import { cn } from '@/utils/cn';

/**
 * A one-to-one DM conversation. The DM counterpart of `ExpenseChat`, scoped to a single
 * `threadId` and reusing the same three behaviours:
 *
 *  1. **Live receive.** Subscribes to `postgres_changes` INSERTs on `dm_messages`
 *     filtered `thread_id=eq.<id>` (after `realtime.setAuth`, so RLS applies to the
 *     socket) — a message posted in any *other* thread never arrives.
 *  2. **Optimistic send.** A typed message shows immediately with a temp id, then the
 *     persisted row from {@link sendDirectMessage} replaces it; the realtime echo of
 *     our own message de-dupes by id.
 *  3. **Ordering.** All merges keep the list oldest-first (the shared `@/lib/chat`
 *     engine, now generic over any {id, createdAt} message).
 *
 * Bodies render as text (never HTML), so emoji render as themselves and there is no
 * XSS surface. On mount, and whenever the other party's message arrives, the thread is
 * marked read so its unread badge clears elsewhere.
 */
export function DmThread({ data }: { data: DmThreadData }) {
  const { threadId, meId, otherUserId, otherName } = data;

  const [messages, setMessages] = React.useState<DirectMessage[]>(
    sortMessages(data.messages),
  );
  const [input, setInput] = React.useState('');
  const [mounted, setMounted] = React.useState(false);

  const tempCounter = React.useRef(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Anchor the frame to the *visible* viewport so the composer stays above the
  // mobile keyboard rather than behind it (see the hook). No-op on desktop.
  useVisualViewportHeight();

  // Live "typing…" on a separate private channel (see useTypingIndicator). In a DM
  // there is exactly one other party, so any typer id resolves to their roster name.
  const { typingUserIds, notifyTyping, stopTyping, clearFrom } =
    useTypingIndicator({ topic: `dm-typing:${threadId}`, meId });
  const typingNames = typingUserIds.map((id) =>
    id === otherUserId ? otherName : 'Someone',
  );

  React.useEffect(() => setMounted(true), []);

  // Mark the thread read on open and whenever new incoming messages settle. Fire and
  // forget — a failed read receipt is harmless and must never interrupt the user.
  const markRead = React.useCallback(() => {
    void markDmRead({ threadId });
  }, [threadId]);

  React.useEffect(() => {
    markRead();
  }, [markRead]);

  // Live messages for this thread only. RLS on the socket means non-participants
  // receive nothing even if they somehow subscribe.
  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`dm-thread:${threadId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'dm_messages',
            filter: `thread_id=eq.${threadId}`,
          },
          (payload) => {
            const incoming = toDirectMessage(payload.new as DmMessage);
            setMessages((prev) => mergeMessage(prev, incoming));
            if (incoming.senderId !== meId) {
              // The other party just wrote — keep our read watermark current so we
              // don't accrue a phantom unread count while actively looking at it, and
              // drop their "typing…" now rather than waiting out the expiry.
              markRead();
              clearFrom(incoming.senderId);
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'dm_messages',
            filter: `thread_id=eq.${threadId}`,
          },
          (payload) => {
            // The only UPDATE is a "deleted for everyone" retraction — swap the tombstone
            // in place (upsert, since the id already exists) for both participants live.
            setMessages((prev) =>
              upsertMessage(prev, toDirectMessage(payload.new as DmMessage)),
            );
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [threadId, meId, markRead, clearFrom]);

  // Keep the newest message in view as the thread grows. Scroll the messages
  // container itself (not `scrollIntoView`, which would also scroll the page and
  // could shift the composer out of view).
  React.useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const canSend = isSendableBody(input);

  function send() {
    const body = normalizeBody(input);
    if (!isSendableBody(body)) return;

    const tempId = `temp-${tempCounter.current++}`;
    const optimistic: DirectMessage = {
      id: tempId,
      threadId,
      senderId: meId,
      body,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => mergeMessage(prev, optimistic));
    setInput('');
    stopTyping(); // sending ends "typing…" immediately for the other side

    void (async () => {
      const res = await sendDirectMessage({ threadId, body });
      if (!res.ok) {
        setMessages((prev) => prev.filter((message) => message.id !== tempId));
        setInput((current) => current || body);
        toast.error(res.error);
        return;
      }
      setMessages((prev) => replaceMessage(prev, tempId, res.data.message));
    })();
  }

  // Hide a message from my view only. Optimistically drop it, restoring it if the
  // server rejects the request.
  function deleteForMe(message: DirectMessage) {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    void (async () => {
      const res = await deleteDirectMessageForMe({ messageId: message.id });
      if (!res.ok) {
        setMessages((prev) => mergeMessage(prev, message));
        toast.error(res.error);
      }
    })();
  }

  // Retract a message for both participants. Optimistically tombstone it (realtime
  // delivers the same to the other side); revert to the original on failure.
  function deleteForEveryone(message: DirectMessage) {
    const tombstone: DirectMessage = {
      ...message,
      body: DELETED_MESSAGE_TEXT,
      deletedAt: new Date().toISOString(),
    };
    setMessages((prev) => upsertMessage(prev, tombstone));
    void (async () => {
      const res = await deleteDirectMessageForEveryone({ messageId: message.id });
      if (!res.ok) {
        setMessages((prev) => upsertMessage(prev, message));
        toast.error(res.error);
      }
    })();
  }

  return (
    <div className="h-dm-thread flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-background/30 md:min-h-[24rem]">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 p-4">
        <Avatar name={otherName} className="h-10 w-10" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Direct message
          </p>
          <h1 className="truncate text-lg font-bold tracking-tight">
            {otherName}
          </h1>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[10rem] flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              No messages yet. Say hi to {otherName}. 👋
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.senderId === meId}
              senderName={otherName}
              showTime={mounted}
              onDeleteForMe={() => deleteForMe(message)}
              onDeleteForEveryone={() => deleteForEveryone(message)}
            />
          ))
        )}
      </div>

      <TypingIndicator names={typingNames} className="shrink-0" />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex shrink-0 items-center gap-2 border-t border-border/50 p-3"
      >
        <Input
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            notifyTyping();
          }}
          placeholder={`Message ${otherName}`}
          aria-label={`Message ${otherName}`}
          maxLength={2000}
          autoComplete="off"
          className="flex-1"
        />
        <Button
          type="submit"
          variant="gradient"
          size="icon"
          disabled={!canSend}
          aria-label="Send message"
        >
          <Send />
        </Button>
      </form>
    </div>
  );
}

/** One message bubble: right-aligned for the current user, left for the other party. */
function MessageBubble({
  message,
  mine,
  senderName,
  showTime,
  onDeleteForMe,
  onDeleteForEveryone,
}: {
  message: DirectMessage;
  mine: boolean;
  senderName: string;
  showTime: boolean;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}) {
  // Rendered only after mount (browser locale/timezone) to avoid a hydration diff.
  const time = showTime
    ? new Date(message.createdAt).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const deleted = isDeleted(message);
  // No menu on an unsent (optimistic) message. "Delete for everyone" is offered only on
  // my own live messages; "Delete for me" stays available even on a tombstone.
  const showMenu = !message.pending;
  const canDeleteForEveryone = mine && !deleted;

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5',
        mine ? 'justify-end' : 'justify-start',
      )}
    >
      {!mine ? (
        <Avatar name={senderName} className="mt-auto h-6 w-6 text-[10px]" />
      ) : null}
      {mine && showMenu ? (
        <MessageActions
          align="end"
          canDeleteForEveryone={canDeleteForEveryone}
          onDeleteForMe={onDeleteForMe}
          onDeleteForEveryone={onDeleteForEveryone}
        />
      ) : null}
      <div className="flex max-w-[80%] flex-col">
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm shadow-sm',
            mine
              ? 'rounded-br-sm bg-primary text-white'
              : 'rounded-bl-sm bg-muted text-foreground',
            deleted && 'bg-muted italic text-muted-foreground',
            message.pending && 'opacity-60',
          )}
        >
          <p className="whitespace-pre-wrap break-words">
            {deleted ? DELETED_MESSAGE_TEXT : message.body}
          </p>
          <span
            suppressHydrationWarning
            className={cn(
              'mt-0.5 block text-right text-[10px]',
              mine && !deleted ? 'text-white/70' : 'text-muted-foreground',
            )}
          >
            {time}
          </span>
        </div>
      </div>
      {!mine && showMenu ? (
        <MessageActions
          align="start"
          canDeleteForEveryone={canDeleteForEveryone}
          onDeleteForMe={onDeleteForMe}
          onDeleteForEveryone={onDeleteForEveryone}
        />
      ) : null}
    </div>
  );
}
