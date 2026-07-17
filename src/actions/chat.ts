'use server';

import { isSendableBody, normalizeBody, toChatMessage } from '@/lib/chat';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';
import type { ChatMessage } from '@/types/dto';

/**
 * Per-expense chat Server Action. Each expense owns an isolated message thread keyed
 * by `expense_id`; sending runs server-side so validation, the participant gate, and
 * RLS all apply before anything persists — and the DB INSERT is what fans the message
 * out to both clients over realtime.
 *
 * The gate lives in the database: the `messages` INSERT policy checks
 * `can_chat_expense(expense_id)` — true only for the expense owner or a linked
 * account of a participating member — and pins `sender_id = auth.uid()`. So a
 * non-participant cannot post regardless of what the client sends. Expected failures
 * are returned, never thrown.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const NOT_ALLOWED_ERROR = 'You can only chat on expenses you’re part of.';

/** Burst cap: how many messages one sender may post within {@link RATE_WINDOW_MS}. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Post a text/emoji message to an expense's chat thread. Validates the body,
 * rate-limits bursts, then inserts the message (RLS enforces the participant gate)
 * — returning the persisted row so the sender can reconcile its optimistic copy. The
 * insert also triggers the realtime event every participant's client subscribes to.
 */
export async function sendExpenseMessage(input: {
  expenseId?: unknown;
  body?: unknown;
}): Promise<ActionResult<{ message: ChatMessage }>> {
  const expenseId =
    typeof input?.expenseId === 'string' ? input.expenseId.trim() : '';
  const rawBody = typeof input?.body === 'string' ? input.body : '';
  if (!UUID_RE.test(expenseId)) return { ok: false, error: 'Missing expense.' };
  if (!isSendableBody(rawBody)) {
    return { ok: false, error: 'Enter a message (up to 2000 characters).' };
  }
  const body = normalizeBody(rawBody);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Basic anti-spam: cap how many messages one account can fire off in a short
  // window. Own messages are readable under RLS, so this count is honest.
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', user.id)
    .gt('created_at', since);
  if ((count ?? 0) >= RATE_LIMIT) {
    return { ok: false, error: 'You’re sending messages too fast. Slow down.' };
  }

  // RLS (messages_insert) enforces the participant gate + sender_id = auth.uid();
  // a non-participant insert is rejected here.
  const { data: row, error } = await supabase
    .from('messages')
    .insert({ expense_id: expenseId, sender_id: user.id, body })
    .select('id, expense_id, sender_id, body, created_at')
    .single();
  if (error) {
    // 42501 = RLS violation → the caller isn't a participant of this expense.
    if (error.code === '42501') return { ok: false, error: NOT_ALLOWED_ERROR };
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!row) return { ok: false, error: GENERIC_ERROR };

  return { ok: true, data: { message: toChatMessage(row) } };
}
