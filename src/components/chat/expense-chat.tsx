'use client';

import * as React from 'react';

import { MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteExpenseMessageForEveryone,
  deleteExpenseMessageForMe,
  sendExpenseMessage,
} from '@/actions/chat';
import { MessageActions } from '@/components/chat/message-actions';
import { TypingIndicator } from '@/components/common/typing-indicator';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import {
  DELETED_MESSAGE_TEXT,
  isDeleted,
  isSendableBody,
  mergeMessage,
  normalizeBody,
  replaceMessage,
  toChatMessage,
  upsertMessage,
} from '@/lib/chat';
import { createClient } from '@/lib/supabase/client';
import type { Message } from '@/types/db';
import type { ChatMessage, ExpenseChatData } from '@/types/dto';
import { cn } from '@/utils/cn';

/**
 * The isolated chat thread for one expense (Phase 6, per-expense model). Everything
 * here is scoped to a single `expenseId`:
 *
 *  1. **Live receive.** Subscribes to `postgres_changes` INSERTs on `messages`
 *     filtered `expense_id=eq.<id>` (after `realtime.setAuth`, so RLS applies to the
 *     socket) — a message posted on any *other* expense never arrives.
 *  2. **Optimistic send.** A typed message shows immediately with a temp id, then the
 *     persisted row from {@link sendExpenseMessage} replaces it; the realtime echo of
 *     our own message de-dupes by id.
 *  3. **Ordering.** All merges keep the list oldest-first (see `@/lib/chat`).
 *
 * Bodies render as text (never HTML), so emoji render as themselves and there is no
 * XSS surface. `canChat` (the participant gate) decides whether the composer shows.
 */
export function ExpenseChat({ data }: { data: ExpenseChatData }) {
  const { expenseId, meId, canChat, senderNames } = data;

  const [messages, setMessages] = React.useState<ChatMessage[]>(data.messages);
  const [input, setInput] = React.useState('');
  const [mounted, setMounted] = React.useState(false);

  const tempCounter = React.useRef(0);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Live "typing…" on a separate private channel (see useTypingIndicator), gated by the
  // same participant check as the composer. Unlike a DM there can be several typers, so
  // each id is resolved to how the viewer knows that sender.
  const { typingUserIds, notifyTyping, stopTyping, clearFrom } = useTypingIndicator({
    topic: `expense-typing:${expenseId}`,
    meId,
    enabled: canChat,
  });
  const typingNames = typingUserIds.map(
    (id) => senderNames[id] ?? 'Participant',
  );

  React.useEffect(() => setMounted(true), []);

  // Live messages for this expense only. RLS on the socket means non-participants
  // receive nothing even if they somehow subscribe.
  React.useEffect(() => {
    if (!canChat) return;
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
        .channel(`expense-chat:${expenseId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `expense_id=eq.${expenseId}`,
          },
          (payload) => {
            const incoming = toChatMessage(payload.new as Message);
            setMessages((prev) => mergeMessage(prev, incoming));
            // Their message landed — drop their "typing…" now rather than waiting out
            // the expiry.
            if (incoming.senderId !== meId) clearFrom(incoming.senderId);
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `expense_id=eq.${expenseId}`,
          },
          (payload) => {
            // The only UPDATE is a "deleted for everyone" retraction — swap the tombstone
            // in place (upsert, since the id already exists) for every participant live.
            setMessages((prev) =>
              upsertMessage(prev, toChatMessage(payload.new as Message)),
            );
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [expenseId, canChat, meId, clearFrom]);

  // Keep the newest message in view as the thread grows.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const canSend = isSendableBody(input);

  function send() {
    const body = normalizeBody(input);
    if (!isSendableBody(body)) return;

    const tempId = `temp-${tempCounter.current++}`;
    const optimistic: ChatMessage = {
      id: tempId,
      expenseId,
      senderId: meId,
      body,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => mergeMessage(prev, optimistic));
    setInput('');
    stopTyping(); // sending ends "typing…" immediately for everyone else

    void (async () => {
      const res = await sendExpenseMessage({ expenseId, body });
      if (!res.ok) {
        setMessages((prev) => prev.filter((message) => message.id !== tempId));
        setInput((current) => current || body);
        toast.error(res.error);
        return;
      }
      setMessages((prev) => replaceMessage(prev, tempId, res.data.message));
    })();
  }

  // Hide a message from my view only. Optimistically drop it, restoring it on failure.
  function deleteForMe(message: ChatMessage) {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    void (async () => {
      const res = await deleteExpenseMessageForMe({ messageId: message.id });
      if (!res.ok) {
        setMessages((prev) => mergeMessage(prev, message));
        toast.error(res.error);
      }
    })();
  }

  // Retract a message for all participants. Optimistically tombstone it (realtime
  // delivers the same to the others); revert to the original on failure.
  function deleteForEveryone(message: ChatMessage) {
    const tombstone: ChatMessage = {
      ...message,
      body: DELETED_MESSAGE_TEXT,
      deletedAt: new Date().toISOString(),
    };
    setMessages((prev) => upsertMessage(prev, tombstone));
    void (async () => {
      const res = await deleteExpenseMessageForEveryone({ messageId: message.id });
      if (!res.ok) {
        setMessages((prev) => upsertMessage(prev, message));
        toast.error(res.error);
      }
    })();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-primary" />
          Chat
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-background/30">
          <div className="max-h-[50vh] min-h-[12rem] flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[10rem] flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">
                  {canChat
                    ? 'No messages yet. Start the conversation about this expense. 👋'
                    : 'Chat is limited to people on this expense.'}
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  mine={message.senderId === meId}
                  senderName={senderNames[message.senderId] ?? 'Participant'}
                  showTime={mounted}
                  onDeleteForMe={() => deleteForMe(message)}
                  onDeleteForEveryone={() => deleteForEveryone(message)}
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <TypingIndicator names={typingNames} />

          {canChat ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-border/50 p-3"
            >
              <Input
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  notifyTyping();
                }}
                placeholder="Message about this expense"
                aria-label="Message about this expense"
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
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** One message bubble: right-aligned for the current user, left for everyone else. */
function MessageBubble({
  message,
  mine,
  senderName,
  showTime,
  onDeleteForMe,
  onDeleteForEveryone,
}: {
  message: ChatMessage;
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
        {!mine ? (
          <span className="mb-0.5 pl-1 text-xs font-medium text-muted-foreground">
            {senderName}
          </span>
        ) : null}
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
