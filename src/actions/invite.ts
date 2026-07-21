'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { logActivity } from '@/lib/activity-log';
import { sendInviteEmail } from '@/lib/email/resend';
import { decideAddRoute } from '@/lib/friends';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import { validateInvite, type InviteFormInput } from '@/schemas/invite.schema';
import type { ActionResult } from '@/types';
import type { InvitationKind } from '@/types/db';

/**
 * Invitation Server Actions (Phase 1). The owner invites one of their people by
 * email to register and *claim* that member row; the recipient accepts through
 * the `accept_invite` SECURITY DEFINER RPC (migration 0014). Every mutation
 * re-validates input and relies on owner-scoped RLS on `invitations` / `members`.
 * Expected failures are returned, never thrown.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** What a successful invite returns: a stable accept link and delivery status. */
export interface InviteResult {
  token: string;
  /** Absolute accept URL (`/invite/<token>`), always safe to copy/share. */
  link: string;
  /** True only when the email was actually sent (Resend accepted the message). */
  emailed: boolean;
  /**
   * Whether email delivery is available (a `RESEND_API_KEY` is set). Lets the UI
   * tell "not configured yet" apart from "configured but the send failed". Set
   * regardless of whether a send was attempted.
   */
  deliveryConfigured: boolean;
  /** The member the invite is bound to (existing or newly created). */
  memberId: string;
  /** The member's display name, for the confirmation message. */
  memberName: string;
}

const norm = (value: string): string => value.trim().toLowerCase();

function siteOrigin(): string {
  // Auth redirects already rely on this; the invite link uses the same base.
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
}

/**
 * Invite an existing member (`memberId`) or a brand-new person (`name`) by email.
 * Records the email on the member (so future adds dedupe by it), reuses a live
 * pending invite for the same person+email so the link stays stable, and always
 * returns a copyable `/invite/<token>` link.
 *
 * `options.send` (default true) chooses the mode: with `send: true` it emails the
 * invite via Resend; with `send: false` it only mints/returns the link for the
 * owner to share manually — no email is attempted either way when Resend is
 * unconfigured. `options.kind` (default 'member') tags a newly-minted invite as a
 * plain member email-invite or a 'friend' request (Phase 4); a reused pending
 * invite is promoted to 'friend' when asked, since only one live invite per
 * member+email can exist.
 */
export async function inviteMemberByEmail(
  input: InviteFormInput,
  options?: { send?: boolean; kind?: InvitationKind },
): Promise<ActionResult<InviteResult>> {
  const send = options?.send ?? true;
  const kind: InvitationKind = options?.kind ?? 'member';
  const parsed = validateInvite(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid invite.' };
  }
  const { memberId, name, targetExpenseId, targetGroupId } = parsed.data;
  // Normalize casing so the stored member/invitation email is canonical and
  // future adds dedupe consistently (the pending-invite unique index is on
  // lower(email); keep the row itself lowercase to match).
  const email = norm(parsed.data.email);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // ── Resolve the member the invite binds to (existing, deduped, or created). ──
  let member: { id: string; name: string; email: string | null } | null = null;

  if (memberId) {
    const { data } = await supabase
      .from('members')
      .select('id, name, email, is_self')
      .eq('id', memberId)
      .eq('owner_id', user.id)
      .single();
    if (!data || data.is_self) {
      return { ok: false, error: 'Member not found.' };
    }
    member = { id: data.id, name: data.name, email: data.email };
    // Record the contact email if we don't already have one.
    if (!data.email) {
      await supabase.from('members').update({ email }).eq('id', data.id);
      member.email = email;
    }
  } else {
    // New person: dedupe by email first, else create.
    const { data: existing } = await supabase
      .from('members')
      .select('id, name, email')
      .eq('owner_id', user.id)
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    if (existing) {
      member = existing;
    } else {
      const { data: created, error: createError } = await supabase
        .from('members')
        .insert({ owner_id: user.id, name: name ?? email, email })
        .select('id, name, email')
        .single();
      if (createError || !created) return { ok: false, error: GENERIC_ERROR };
      member = created;
    }
  }

  // ── Reuse a live pending invite for this person+email, else mint one. ──
  const { data: pending } = await supabase
    .from('invitations')
    .select('token')
    .eq('member_id', member.id)
    .eq('status', 'pending')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  let token = pending?.token ?? '';
  if (!token) {
    const { data: invite, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        inviter_id: user.id,
        member_id: member.id,
        email,
        target_expense_id: targetExpenseId,
        target_group_id: targetGroupId,
        // Only set `kind` for a friend request — omitting it lets the DB default
        // ('member') stand, keeping this insert valid even before 0016 is applied.
        ...(kind === 'friend' ? { kind } : {}),
      })
      .select('token')
      .single();
    if (inviteError || !invite) return { ok: false, error: GENERIC_ERROR };
    token = invite.token;
  } else if (kind === 'friend') {
    // Reused an existing live invite (the pending unique index allows only one per
    // member+email, any kind). Promote it to a friend request so the outcome and
    // the row agree; a no-op if it was already 'friend'.
    await supabase
      .from('invitations')
      .update({ kind })
      .eq('token', token)
      .eq('status', 'pending');
  }

  // ── Deliver (or not). Never fails the action on a mail error — the link is
  //    always usable. `send: false` skips email entirely (share-the-link mode). ──
  const origin = siteOrigin();
  if (!origin) {
    // Without an absolute base the link is path-only (`/invite/<token>`): fine
    // when opened on this origin, but broken in an email. Surface it in logs so
    // a missing NEXT_PUBLIC_SITE_URL is diagnosable instead of a silent 404.
    console.warn(
      '[invite] NEXT_PUBLIC_SITE_URL is not set — invite links are relative and ' +
        'will not resolve when emailed. Set it to the app’s public URL.',
    );
  }
  const link = `${origin}${ROUTES.invite}/${token}`;
  const deliveryConfigured = Boolean(process.env.RESEND_API_KEY);

  let emailed = false;
  if (send) {
    const {
      data: { user: fresh },
    } = await supabase.auth.getUser();
    const inviterName =
      (fresh?.user_metadata?.full_name as string | undefined)?.trim() ||
      'Someone';

    const result = await sendInviteEmail({
      to: email,
      inviterName,
      memberName: member.name,
      acceptUrl: link,
    });
    emailed = result.sent;
  }

  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.expenses);
  revalidatePath(ROUTES.friends);
  return {
    ok: true,
    data: {
      token,
      link,
      emailed,
      deliveryConfigured,
      memberId: member.id,
      memberName: member.name,
    },
  };
}

/** How an add-friend resolved, driving the confirmation message. */
export type FriendAddOutcome =
  /** The email had an account → an in-app friend request was created. */
  | 'request'
  /** No account for the email → an email invite to register was sent/prepared. */
  | 'invited'
  /** Share-a-link mode → a copyable invite link was minted. */
  | 'link';

export interface FriendAddResult {
  outcome: FriendAddOutcome;
  memberId: string;
  memberName: string;
  /**
   * The copyable `/invite/<token>` link. Always present — the 'request' path
   * mints one too, though that request is surfaced in-app rather than by link.
   */
  link: string;
  /** True only when an email was actually sent (Resend accepted it). */
  emailed: boolean;
  /** Whether email delivery is configured (a `RESEND_API_KEY` is present). */
  deliveryConfigured: boolean;
}

function toFriendResult(r: InviteResult): Omit<FriendAddResult, 'outcome'> {
  return {
    memberId: r.memberId,
    memberName: r.memberName,
    link: r.link,
    emailed: r.emailed,
    deliveryConfigured: r.deliveryConfigured,
  };
}

/**
 * Add a friend by email or shareable link (Phase 4). A friend is a member linked
 * to a real account, so this rides the same 0014/0016 invitation rail rather than
 * introducing a social graph.
 *
 *   - `mode: 'link'` — mint a copyable `/invite/<token>` to share manually.
 *   - `mode: 'auto'` (default) — branch on whether the email already has an account:
 *       • it does, and isn't you → an in-app **friend request** (`kind='friend'`),
 *         which the recipient sees on their Requests page (Phase 5).
 *       • it doesn't → an **email invite** (`kind='member'`) to register and claim.
 *
 * Adding your own email is rejected. The account lookup uses `find_profile_by_email`
 * (migration 0016); if that helper isn't live yet, or errors, this falls back to the
 * always-safe email-invite path rather than blocking the add. Expected failures are
 * returned, never thrown.
 */
export async function addFriend(
  input: InviteFormInput,
  options?: { mode?: 'auto' | 'link' },
): Promise<ActionResult<FriendAddResult>> {
  const mode = options?.mode ?? 'auto';
  const parsed = validateInvite(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid invite.' };
  }
  const email = norm(parsed.data.email);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Share-a-link mode never emails and never needs an account lookup.
  if (mode === 'link') {
    const result = await inviteMemberByEmail(input, { send: false });
    if (!result.ok) return result;
    return { ok: true, data: { outcome: 'link', ...toFriendResult(result.data) } };
  }

  // Auto: does the email already have an account? A missing/failed lookup (0016
  // not applied yet) degrades to the email-invite path.
  const { data: profileId, error: lookupError } = await supabase.rpc(
    'find_profile_by_email',
    { p_email: email },
  );
  const route = lookupError
    ? 'invite'
    : decideAddRoute({
        profileId: (profileId as string | null) ?? null,
        ownerId: user.id,
      });

  if (route === 'self') {
    return {
      ok: false,
      error: 'That’s your own email — you can’t add yourself.',
    };
  }

  if (route === 'request') {
    // Existing account → in-app friend request (no email; shown on Requests).
    const result = await inviteMemberByEmail(input, {
      send: false,
      kind: 'friend',
    });
    if (!result.ok) return result;
    await logActivity(supabase, [
      {
        ownerId: user.id,
        type: 'friend_added',
        subject: result.data.memberName,
        memberId: result.data.memberId,
      },
    ]);
    return {
      ok: true,
      data: { outcome: 'request', ...toFriendResult(result.data) },
    };
  }

  // No account → email invite to register and claim the member row.
  const result = await inviteMemberByEmail(input, { send: true });
  if (!result.ok) return result;
  await logActivity(supabase, [
    {
      ownerId: user.id,
      type: 'friend_added',
      subject: result.data.memberName,
      memberId: result.data.memberId,
    },
  ]);
  return { ok: true, data: { outcome: 'invited', ...toFriendResult(result.data) } };
}

/**
 * Accept an invite for the signed-in user: links their account to the invited
 * member and returns the app route to land on. Wraps the `accept_invite` RPC,
 * which validates the token and does the privileged writes. A null route means
 * the invite is invalid, expired, or already claimed by someone else.
 */
export async function acceptInvite(
  token: unknown,
): Promise<ActionResult<{ route: string }>> {
  const value = typeof token === 'string' ? token.trim() : '';
  if (!value) return { ok: false, error: 'Missing invite.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data, error } = await supabase.rpc('accept_invite', {
    p_token: value,
  });
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (!data) {
    return {
      ok: false,
      error: 'This invite isn’t valid anymore. Ask for a new one.',
    };
  }

  revalidatePath('/', 'layout');
  return { ok: true, data: { route: data } };
}

/**
 * Reject an invite the signed-in user received (Phase 5). Flips a pending invite
 * addressed to them — matched by their account or email — to 'rejected' via the
 * `reject_invite` RPC (migration 0016), whose WHERE clause is the authorization
 * guard. Succeeds with `changed: false` when nothing matched (already decided,
 * revoked, or expired) so the Requests UI can refresh idempotently; only a hard
 * RPC error is surfaced.
 */
export async function rejectInvite(
  token: unknown,
): Promise<ActionResult<{ changed: boolean }>> {
  const value = typeof token === 'string' ? token.trim() : '';
  if (!value) return { ok: false, error: 'Missing invite.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data, error } = await supabase.rpc('reject_invite', {
    p_token: value,
  });
  if (error) return { ok: false, error: GENERIC_ERROR };

  // Refresh the whole shell so both the Requests tabs and the nav badge update.
  revalidatePath('/', 'layout');
  return { ok: true, data: { changed: Boolean(data) } };
}
