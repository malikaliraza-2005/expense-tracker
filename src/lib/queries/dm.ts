import { cache } from 'react';

import { getUser } from '@/lib/auth';
import { toDirectMessage, toDmConversation, type DmThreadListRow } from '@/lib/dm';
import { createClient } from '@/lib/supabase/server';
import type {
  DmCandidate,
  DmConversation,
  DmThreadData,
} from '@/types/dto';

/**
 * Direct-message reads. DMs are one-to-one and keyed by a thread (a pair of accounts).
 * Every read is RLS-scoped: `dm_threads`/`dm_messages`/`dm_reads` are visible only to
 * the two participants (migration 0029), and `list_dm_threads` runs SECURITY INVOKER
 * so that same RLS scopes it.
 *
 * Display names never come from a profiles join — profiles are self-only readable
 * (0010 dropped profiles_select_shared; 0015 confirms it as deliberate) — so a
 * partner's name is resolved from the CURRENT user's own `members` roster via
 * `linked_user_id`, exactly as queries/chat.ts does for expense chat. A partner not in
 * your roster falls back to a generic label.
 */

/**
 * Map from a connected account id to the name the current user gave them, built from
 * the caller's own members roster. RLS keeps this to the caller's rows, and `getUser`
 * excludes the caller's own id.
 */
async function rosterNames(
  supabase: ReturnType<typeof createClient>,
  selfId: string,
): Promise<Map<string, string>> {
  const { data: members } = await supabase
    .from('members')
    .select('name, linked_user_id')
    .not('linked_user_id', 'is', null);

  const names = new Map<string, string>();
  for (const m of members ?? []) {
    if (m.linked_user_id && m.linked_user_id !== selfId) {
      names.set(m.linked_user_id, m.name);
    }
  }
  return names;
}

/** The current user's conversations, newest-activity first, with unread counts. */
export const getConversations = cache(
  async (): Promise<DmConversation[]> => {
    const user = await getUser();
    if (!user) return [];

    const supabase = createClient();
    const [{ data: rows }, names] = await Promise.all([
      supabase.rpc('list_dm_threads'),
      rosterNames(supabase, user.id),
    ]);

    return ((rows ?? []) as DmThreadListRow[]).map((row) =>
      toDmConversation(row, user.id, (id) => names.get(id)),
    );
  },
);

/**
 * One DM thread's history plus who it's with, or `null` when the thread doesn't exist
 * or the caller isn't a participant (RLS returns no rows either way, so an outsider and
 * a bad id are indistinguishable — by design). The thread's own row confirms
 * participation and yields the other party; messages come oldest-first.
 */
export const getDmThread = cache(
  async (threadId: string): Promise<DmThreadData | null> => {
    const user = await getUser();
    if (!user) return null;

    const supabase = createClient();

    // RLS returns the thread only to its two participants, so a readable row IS proof
    // of access. No separate gate call needed.
    const { data: thread } = await supabase
      .from('dm_threads')
      .select('id, user_a, user_b')
      .eq('id', threadId)
      .maybeSingle();
    if (!thread) return null;

    const otherUserId =
      thread.user_a === user.id ? thread.user_b : thread.user_a;

    const [{ data: rows }, names] = await Promise.all([
      supabase
        .from('dm_messages')
        // The embedded `dm_message_deletions` is RLS-scoped to the caller's own rows, so
        // a non-empty array means "I deleted this for myself" — filtered out below. A
        // message deleted for everyone (deleted_at set) stays, rendered as a tombstone.
        .select(
          'id, thread_id, sender_id, body, created_at, deleted_at, dm_message_deletions(user_id)',
        )
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true }),
      rosterNames(supabase, user.id),
    ]);

    const visible = (rows ?? []).filter(
      (row) => (row.dm_message_deletions?.length ?? 0) === 0,
    );

    return {
      threadId,
      meId: user.id,
      otherUserId,
      otherName: names.get(otherUserId) ?? 'Someone',
      messages: visible.map(toDirectMessage),
    };
  },
);

/**
 * People the current user can start a DM with: their connected accounts (members
 * linked to a real account), each flagged with whether a thread already exists so the
 * UI can label the action "Message" vs "Open". Sorted alphabetically. Name-only
 * members have no account and are excluded.
 */
export const getDmCandidates = cache(async (): Promise<DmCandidate[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const [{ data: members }, { data: threadRows }] = await Promise.all([
    supabase
      .from('members')
      .select('name, linked_user_id')
      .not('linked_user_id', 'is', null),
    supabase.rpc('list_dm_threads'),
  ]);

  const withThread = new Set(
    ((threadRows ?? []) as DmThreadListRow[]).map((r) => r.other_user_id),
  );

  const seen = new Set<string>();
  const candidates: DmCandidate[] = [];
  for (const m of members ?? []) {
    const id = m.linked_user_id;
    // Exclude self and de-dupe (the same account can be linked from >1 member row
    // only in edge cases, but guard anyway).
    if (!id || id === user.id || seen.has(id)) continue;
    seen.add(id);
    candidates.push({
      userId: id,
      name: m.name,
      hasThread: withThread.has(id),
    });
  }

  candidates.sort((a, b) => a.name.localeCompare(b.name));
  return candidates;
});
