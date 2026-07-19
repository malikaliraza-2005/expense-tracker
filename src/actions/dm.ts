'use server';

import { revalidatePath } from 'next/cache';

import { isSendableBody, normalizeBody, toDirectMessage } from '@/lib/dm';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';
import type { DirectMessage } from '@/types/dto';

/**
 * Direct-message Server Actions. DMs are one-to-one between two CONNECTED accounts
 * (linked by a members row either direction). Every rule that matters is enforced in
 * the database — a Server Action is not a trust boundary (migration 0028):
 *
 *  - `get_or_create_dm_thread` (SECURITY DEFINER) re-derives the caller from
 *    auth.uid(), refuses a non-connected pair, and guarantees ONE thread per pair.
 *  - the `dm_messages` INSERT policy pins `sender_id = auth.uid()` and checks
 *    thread membership, so a non-participant cannot post whatever the client sends.
 *
 * Expected failures are returned, never thrown.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const NOT_CONNECTED_ERROR =
  'You can only message people you’re connected with.';
const NOT_ALLOWED_ERROR = 'You’re not part of this conversation.';

/** Burst cap: messages one sender may post within {@link RATE_WINDOW_MS}. Mirrors chat. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Open (or find) the DM thread with another account, returning its id so the caller
 * can navigate to it. The RPC is the sole authority: it returns null unless the two
 * accounts are connected, so this never leaks whether `otherUserId` is even a real
 * account — a not-connected and a not-a-user answer are identical.
 */
export async function openDmThread(input: {
  otherUserId?: unknown;
}): Promise<ActionResult<{ threadId: string }>> {
  const otherUserId =
    typeof input?.otherUserId === 'string' ? input.otherUserId.trim() : '';
  if (!UUID_RE.test(otherUserId)) return { ok: false, error: 'Missing person.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data: threadId, error } = await supabase.rpc(
    'get_or_create_dm_thread',
    { p_other: otherUserId },
  );
  if (error) return { ok: false, error: GENERIC_ERROR };
  // Null = not connected (or self). The RPC never distinguishes, so neither do we.
  if (!threadId) return { ok: false, error: NOT_CONNECTED_ERROR };

  revalidatePath('/messages');
  return { ok: true, data: { threadId } };
}

/**
 * Post a text/emoji message to a DM thread. Validates the body, rate-limits bursts,
 * then inserts (RLS enforces membership + `sender_id = auth.uid()`) — returning the
 * persisted row so the sender can reconcile its optimistic copy. The insert is what
 * fans the message out to both clients over realtime.
 */
export async function sendDirectMessage(input: {
  threadId?: unknown;
  body?: unknown;
}): Promise<ActionResult<{ message: DirectMessage }>> {
  const threadId =
    typeof input?.threadId === 'string' ? input.threadId.trim() : '';
  const rawBody = typeof input?.body === 'string' ? input.body : '';
  if (!UUID_RE.test(threadId)) {
    return { ok: false, error: 'Missing conversation.' };
  }
  if (!isSendableBody(rawBody)) {
    return { ok: false, error: 'Enter a message (up to 2000 characters).' };
  }
  const body = normalizeBody(rawBody);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Basic anti-spam across all of my DM sends, matching the per-expense chat cap.
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('dm_messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', user.id)
    .gt('created_at', since);
  if ((count ?? 0) >= RATE_LIMIT) {
    return { ok: false, error: 'You’re sending messages too fast. Slow down.' };
  }

  const { data: row, error } = await supabase
    .from('dm_messages')
    .insert({ thread_id: threadId, sender_id: user.id, body })
    .select('id, thread_id, sender_id, body, created_at, deleted_at')
    .single();
  if (error) {
    // 42501 = RLS violation → the caller isn't a participant of this thread.
    if (error.code === '42501') return { ok: false, error: NOT_ALLOWED_ERROR };
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!row) return { ok: false, error: GENERIC_ERROR };

  return { ok: true, data: { message: toDirectMessage(row) } };
}

/**
 * Mark a DM thread read up to now for the current user — clearing its unread badge.
 * Upserts the per-user watermark; RLS restricts the row to `user_id = auth.uid()` on a
 * thread the caller is on. Best-effort from the UI's perspective, but reports failure
 * so the caller can decide whether to retry.
 */
export async function markDmRead(input: {
  threadId?: unknown;
}): Promise<ActionResult> {
  const threadId =
    typeof input?.threadId === 'string' ? input.threadId.trim() : '';
  if (!UUID_RE.test(threadId)) return { ok: false, error: 'Missing conversation.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { error } = await supabase
    .from('dm_reads')
    .upsert(
      {
        thread_id: threadId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'thread_id,user_id' },
    );
  if (error) return { ok: false, error: GENERIC_ERROR };

  // Refresh the surfaces that show an unread badge.
  revalidatePath('/messages');
  revalidatePath('/dashboard');
  return { ok: true, data: undefined };
}

/**
 * Delete a DM message FOR EVERYONE — retracting it from both participants. The RPC is
 * the sole authority: it soft-deletes and tombstones the body only when the caller is
 * the message's sender, so this is a no-op (returns `notChanged`) for anyone else or an
 * already-deleted message. The UPDATE fans the tombstone out to both clients over
 * realtime; the caller's own view updates optimistically.
 */
export async function deleteDirectMessageForEveryone(input: {
  messageId?: unknown;
}): Promise<ActionResult> {
  const messageId =
    typeof input?.messageId === 'string' ? input.messageId.trim() : '';
  if (!UUID_RE.test(messageId)) return { ok: false, error: 'Missing message.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data: changed, error } = await supabase.rpc(
    'delete_dm_message_for_everyone',
    { p_message: messageId },
  );
  if (error) return { ok: false, error: GENERIC_ERROR };
  // Only the sender can retract; the RPC returns false otherwise. Report it so the
  // client doesn't optimistically tombstone a message it wasn't allowed to.
  if (!changed) {
    return { ok: false, error: 'You can only delete your own messages for everyone.' };
  }

  revalidatePath('/messages');
  return { ok: true, data: undefined };
}

/**
 * Delete a DM message FOR ME — hiding it from my own view only, on every device and
 * across reloads. Records a per-user watermark row (RLS pins `user_id = auth.uid()`);
 * the other participant is unaffected and never learns of it. Idempotent — hiding an
 * already-hidden message is a no-op.
 */
export async function deleteDirectMessageForMe(input: {
  messageId?: unknown;
}): Promise<ActionResult> {
  const messageId =
    typeof input?.messageId === 'string' ? input.messageId.trim() : '';
  if (!UUID_RE.test(messageId)) return { ok: false, error: 'Missing message.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { error } = await supabase
    .from('dm_message_deletions')
    .upsert(
      { message_id: messageId, user_id: user.id },
      { onConflict: 'message_id,user_id', ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath('/messages');
  return { ok: true, data: undefined };
}
