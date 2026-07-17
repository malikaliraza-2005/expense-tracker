import { cache } from 'react';

import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Invitation, InvitationKind, InvitationStatus } from '@/types/db';
import type { RequestItem } from '@/types/dto';

/**
 * Requests reads (Phase 5). Every request — friend request or member email-invite,
 * sent or received — is a row in `invitations`. Row visibility is governed by RLS:
 * the owner sees their own via `invitations_all_own`; a recipient sees invites
 * addressed to them via `invitations_select_recipient` (migration 0016). This
 * module flattens those rows into {@link RequestItem}s from the caller's point of
 * view, resolving the other party's display name.
 *
 * Sent rows join the owner's own `members` (readable) for the invitee name.
 * Received rows can't: the inviter's profile and member rows aren't visible under
 * RLS, so their name comes from the public `invite_details` RPC — the same
 * SECURITY DEFINER read the invite landing page uses.
 */

/** A pending invite past its expiry reads as 'expired', matching invite_details. */
function effectiveStatus(inv: Invitation): InvitationStatus {
  const status = inv.status as InvitationStatus;
  if (status === 'pending' && new Date(inv.expires_at).getTime() < Date.now()) {
    return 'expired';
  }
  return status;
}

export const getRequests = cache(async (): Promise<RequestItem[]> => {
  const user = await getUser();
  if (!user) return [];
  const myId = user.id;

  const supabase = createClient();
  const { data } = await supabase
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Invitation[];
  if (rows.length === 0) return [];

  // Anything I sent is 'sent'; anything else visible to me is a request I received.
  const sent = rows.filter((row) => row.inviter_id === myId);
  const received = rows.filter((row) => row.inviter_id !== myId);

  // Sent → resolve invitee names from my own roster (one batched read).
  const nameById = new Map<string, string>();
  const memberIds = [...new Set(sent.map((row) => row.member_id))];
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from('members')
      .select('id, name')
      .in('id', memberIds);
    for (const member of members ?? []) nameById.set(member.id, member.name);
  }

  // Received → the inviter isn't readable under RLS, so fetch their display name
  // from the public invite_details RPC (one per row; received counts are small).
  const inviterNames = await Promise.all(
    received.map(async (row) => {
      const { data: detail } = await supabase.rpc('invite_details', {
        p_token: row.token,
      });
      return (Array.isArray(detail) ? detail[0]?.inviter_name : null) ?? 'Someone';
    }),
  );

  const toItem = (
    row: Invitation,
    direction: RequestItem['direction'],
    counterpartyName: string,
  ): RequestItem => ({
    id: row.id,
    token: row.token,
    direction,
    kind: (row.kind as InvitationKind) ?? 'member',
    status: effectiveStatus(row),
    email: row.email,
    counterpartyName,
    createdAt: row.created_at,
  });

  const items = [
    ...received.map((row, index) =>
      toItem(row, 'received', inviterNames[index]),
    ),
    ...sent.map((row) =>
      toItem(row, 'sent', nameById.get(row.member_id) ?? row.email),
    ),
  ];

  // Newest first across both directions (ISO timestamps sort lexically).
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

/**
 * Count of received requests still awaiting a decision — the nav badge. A lean
 * head/count query (no name resolution) so it's cheap to run in the app shell on
 * every navigation. Mirrors {@link ACTIONABLE_STATUSES}: pending/clarifying,
 * received (not self-sent), and not past expiry.
 */
export const getReceivedActionableCount = cache(async (): Promise<number> => {
  const user = await getUser();
  if (!user) return 0;

  const supabase = createClient();
  const { count } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .neq('inviter_id', user.id)
    .in('status', ['pending', 'clarifying'])
    .gt('expires_at', new Date().toISOString());

  return count ?? 0;
});
