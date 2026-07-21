/**
 * Direct-message logic — pure, dependency-free rules shared by the DM action, the DM
 * thread client, the conversation-list query, and their tests. Kept out of the query/
 * action layer so they run identically on the server and in the browser, with no
 * Supabase dependency (the same split `@/lib/chat` and `@/lib/friends` use).
 *
 * DMs are one-to-one and keyed by a THREAD (a pair of accounts), where per-expense
 * chat is keyed by an expense. The two are separate tables and separate surfaces, but
 * a message is ordered and de-duplicated identically in both — so body validation and
 * the merge/sort engine are imported from `@/lib/chat` rather than re-implemented, and
 * only the DM-specific projections and the conversation-list shaping live here.
 */
import type { DmMessage } from '@/types/db';
import type { DirectMessage, DmConversation } from '@/types/dto';

// Re-export the shared body rules so DM callers have one import site and the DM and
// chat surfaces provably agree on what "sendable" means (both mirror the 1–2000 DB
// check on their respective *_messages.body columns).
export {
  MAX_MESSAGE_LENGTH,
  isSendableBody,
  normalizeBody,
} from '@/lib/chat';

/** The `dm_messages`-row fields both the server read and the realtime payload carry. */
type DmMessageRow = Pick<
  DmMessage,
  'id' | 'thread_id' | 'sender_id' | 'body' | 'created_at' | 'deleted_at'
>;

/**
 * Camel-case a `dm_messages` row into a {@link DirectMessage}. Used by both the server
 * thread query and the client's realtime handler so a message looks identical however
 * it arrives — the DM counterpart of `toChatMessage`.
 */
export function toDirectMessage(row: DmMessageRow): DirectMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * The shape `list_dm_threads()` returns, one row per conversation. Mirrors the RPC's
 * `returns table (...)` columns so the query layer maps it without guessing.
 */
export interface DmThreadListRow {
  thread_id: string;
  other_user_id: string;
  last_body: string | null;
  last_at: string | null;
  last_sender_id: string | null;
  unread_count: number | null;
}

/**
 * Shape one `list_dm_threads()` row into a {@link DmConversation} for the list UI.
 * `otherName` is resolved by the caller from their own members roster (profiles aren't
 * readable across accounts); `nameFor` supplies it, falling back to a generic label.
 * `meId` decides whether the last message reads as "You:" — computed here, not in SQL,
 * because the RPC has no reason to special-case the caller's own id in its output.
 */
export function toDmConversation(
  row: DmThreadListRow,
  meId: string,
  nameFor: (userId: string) => string | undefined,
): DmConversation {
  return {
    threadId: row.thread_id,
    otherUserId: row.other_user_id,
    otherName: nameFor(row.other_user_id) ?? DM_FALLBACK_NAME,
    lastBody: row.last_body,
    lastAt: row.last_at,
    lastFromMe: row.last_sender_id === meId,
    // The RPC counts only the other party's unread messages; coalesce a null (empty
    // thread, no reads row) to zero so the badge logic never sees NaN.
    unreadCount: row.unread_count ?? 0,
  };
}

/** Shown for a conversation partner who isn't in the viewer's roster under a name. */
export const DM_FALLBACK_NAME = 'Someone';

/** Total unread across all conversations — the number the dashboard/nav badge shows. */
export function totalUnread(conversations: DmConversation[]): number {
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

/**
 * A short one-line preview of a conversation's last message for the list card: the
 * body prefixed with "You: " when the viewer sent it, or a gentle placeholder for a
 * thread that exists but has no messages yet.
 */
export function previewLine(conversation: DmConversation): string {
  if (conversation.lastBody === null) {
    return 'No messages yet';
  }
  return conversation.lastFromMe
    ? `You: ${conversation.lastBody}`
    : conversation.lastBody;
}
