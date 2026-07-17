/**
 * Chat logic — pure, dependency-free rules shared by the chat action (body
 * validation), the expense-chat client (optimistic + realtime reconciliation), and
 * their tests. Kept out of the query/action layer so they run identically on the
 * server and in the browser, with no Supabase dependency.
 *
 * Chat is per-expense: every message belongs to one `expense_id` thread. Bodies are
 * text/emoji only — emoji are just Unicode, so there is no special handling here; the
 * UI renders every body as text (never HTML), so validation is purely about length.
 * Ordering and de-duplication live here too, since a message can arrive twice (once
 * as the sender's optimistic echo, once over realtime) and every client must converge
 * on the same stable order.
 */
import type { Message } from '@/types/db';
import type { ChatMessage } from '@/types/dto';

/** Matches the DB check on `messages.body` (char_length between 1 and 2000). */
export const MAX_MESSAGE_LENGTH = 2000;

/** The `messages`-row fields both the server read and the realtime payload carry. */
type MessageRow = Pick<
  Message,
  'id' | 'expense_id' | 'sender_id' | 'body' | 'created_at'
>;

/**
 * Camel-case a `messages` row into a {@link ChatMessage}. Used by both the server
 * chat query and the client's realtime handler so a message looks identical however
 * it arrives.
 */
export function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    expenseId: row.expense_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

/** The stored form of a typed body: trimmed of surrounding whitespace. */
export function normalizeBody(raw: string): string {
  return raw.trim();
}

/**
 * Whether a typed body is sendable: non-empty and within the length cap once
 * trimmed. Mirrors the `messages_body_check` constraint so the client, the action,
 * and the database all agree on what "valid" means.
 */
export function isSendableBody(raw: string): boolean {
  const body = normalizeBody(raw);
  return body.length >= 1 && body.length <= MAX_MESSAGE_LENGTH;
}

/**
 * Total order over messages: oldest first by `createdAt`, breaking ties by `id` so
 * the order is deterministic even when two messages share a timestamp.
 */
export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** Sort messages into their canonical (oldest-first) display order. */
export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(compareMessages);
}

/**
 * Fold a message into a list, de-duplicating by `id` and keeping the list sorted.
 * A message can be delivered twice — the sender adds it optimistically / from the
 * action's return value, then realtime echoes the same persisted row — so an
 * already-present id is ignored rather than duplicated. Persisted ids never collide
 * with the temporary ids of optimistic messages, so real and optimistic copies
 * coexist until {@link replaceMessage} swaps them.
 */
export function mergeMessage(
  messages: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage[] {
  if (messages.some((message) => message.id === incoming.id)) {
    return messages;
  }
  return sortMessages([...messages, incoming]);
}

/**
 * Replace the optimistic message `tempId` with its persisted counterpart once the
 * send action returns — dropping the temp row and merging the real one (which
 * de-dupes cleanly if realtime already delivered it). If `tempId` is absent the
 * real message is simply merged.
 */
export function replaceMessage(
  messages: ChatMessage[],
  tempId: string,
  real: ChatMessage,
): ChatMessage[] {
  return mergeMessage(
    messages.filter((message) => message.id !== tempId),
    real,
  );
}
