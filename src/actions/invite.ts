'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { sendInviteEmail } from '@/lib/email/resend';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import { validateInvite, type InviteFormInput } from '@/schemas/invite.schema';
import type { ActionResult } from '@/types';

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
 * unconfigured.
 */
export async function inviteMemberByEmail(
  input: InviteFormInput,
  options?: { send?: boolean },
): Promise<ActionResult<InviteResult>> {
  const send = options?.send ?? true;
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
      })
      .select('token')
      .single();
    if (inviteError || !invite) return { ok: false, error: GENERIC_ERROR };
    token = invite.token;
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
  return {
    ok: true,
    data: { token, link, emailed, deliveryConfigured, memberId: member.id },
  };
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
