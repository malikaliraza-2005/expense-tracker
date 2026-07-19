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
  'id' | 'expense_id' | 'sender_id' | 'body' | 'created_at' | 'deleted_at'
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
    deletedAt: row.deleted_at,
  };
}

/**
 * The placeholder shown in place of a message that was deleted for everyone. The DB
 * overwrites the body with this same string on retraction, but the UI keys off
 * {@link isDeleted} (the `deletedAt` flag) so it can style the tombstone rather than
 * trusting a body value.
 */
export const DELETED_MESSAGE_TEXT = 'This message was deleted';

/** Whether a message was deleted for everyone (its `deletedAt` is set). */
export function isDeleted(message: { deletedAt?: string | null }): boolean {
  return message.deletedAt != null;
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
 * The minimum a value needs to be ordered and de-duplicated by the engine below: a
 * stable `id` and an ISO `createdAt`. Both {@link ChatMessage} (per-expense) and
 * `DirectMessage` (DMs) satisfy it, so the same sort/merge logic serves both surfaces
 * without either importing the other's shape.
 */
export interface OrderableMessage {
  id: string;
  createdAt: string;
}

/**
 * Total order over messages: oldest first by `createdAt`, breaking ties by `id` so
 * the order is deterministic even when two messages share a timestamp.
 */
export function compareMessages(a: OrderableMessage, b: OrderableMessage): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** Sort messages into their canonical (oldest-first) display order. */
export function sortMessages<T extends OrderableMessage>(messages: T[]): T[] {
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
export function mergeMessage<T extends OrderableMessage>(
  messages: T[],
  incoming: T,
): T[] {
  if (messages.some((message) => message.id === incoming.id)) {
    return messages;
  }
  return sortMessages([...messages, incoming]);
}

/**
 * Fold an *updated* message into a list: if a message with the same id is present it's
 * replaced in place (kept sorted — `createdAt` is unchanged by an edit/retraction, so
 * position is stable); otherwise it's merged as new. This is how a realtime UPDATE — a
 * "deleted for everyone" retraction — swaps the tombstone in live, where
 * {@link mergeMessage} would ignore it as a duplicate id.
 */
export function upsertMessage<T extends OrderableMessage>(
  messages: T[],
  incoming: T,
): T[] {
  if (!messages.some((message) => message.id === incoming.id)) {
    return mergeMessage(messages, incoming);
  }
  return sortMessages(
    messages.map((message) => (message.id === incoming.id ? incoming : message)),
  );
}

/**
 * Replace the optimistic message `tempId` with its persisted counterpart once the
 * send action returns — dropping the temp row and merging the real one (which
 * de-dupes cleanly if realtime already delivered it). If `tempId` is absent the
 * real message is simply merged.
 */
export function replaceMessage<T extends OrderableMessage>(
  messages: T[],
  tempId: string,
  real: T,
): T[] {
  return mergeMessage(
    messages.filter((message) => message.id !== tempId),
    real,
  );
}
