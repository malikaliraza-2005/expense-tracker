import { cache } from 'react';

import { getUser } from '@/lib/auth';
import { toChatMessage } from '@/lib/chat';
import { createClient } from '@/lib/supabase/server';
import type { ExpenseChatData } from '@/types/dto';

/**
 * Per-expense chat reads. Every expense owns an isolated thread keyed by
 * `expense_id`; this loads one expense's messages plus the context the panel needs:
 * whether the current account may post (the participant gate) and display names for
 * other senders. Isolation is structural — the query only ever filters by a single
 * `expense_id`, so no other expense's messages can appear — and RLS
 * (`can_chat_expense`) is the backstop, returning nothing to a non-participant.
 */
export const getExpenseChat = cache(
  async (expenseId: string): Promise<ExpenseChatData> => {
    const user = await getUser();
    const empty: ExpenseChatData = {
      expenseId,
      meId: user?.id ?? '',
      canChat: false,
      messages: [],
      senderNames: {},
    };
    if (!user) return empty;

    const supabase = createClient();

    // Authoritative gate (owner or linked participant), the same predicate the RLS
    // policies use. Drives whether the composer is shown.
    const { data: canChat } = await supabase.rpc('can_chat_expense', {
      p_expense: expenseId,
    });
    if (!canChat) return { ...empty, canChat: false };

    // Messages for this expense only (RLS re-checks the gate); oldest-first. The
    // embedded `message_deletions` is RLS-scoped to the caller, so a non-empty array
    // means "I deleted this for myself" — filtered out below. A message deleted for
    // everyone (deleted_at set) stays, rendered as a tombstone.
    const [{ data: rows }, { data: members }] = await Promise.all([
      supabase
        .from('messages')
        .select(
          'id, expense_id, sender_id, body, created_at, deleted_at, message_deletions(user_id)',
        )
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true }),
      // Names for other senders: any account I can see linked to one of my members.
      supabase
        .from('members')
        .select('name, linked_user_id')
        .not('linked_user_id', 'is', null),
    ]);

    const senderNames: Record<string, string> = {};
    for (const member of members ?? []) {
      if (member.linked_user_id && member.linked_user_id !== user.id) {
        senderNames[member.linked_user_id] = member.name;
      }
    }

    const visible = (rows ?? []).filter(
      (row) => (row.message_deletions?.length ?? 0) === 0,
    );

    return {
      expenseId,
      meId: user.id,
      canChat: true,
      messages: visible.map(toChatMessage),
      senderNames,
    };
  },
);
