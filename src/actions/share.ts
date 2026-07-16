'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';

/**
 * Member share-link Server Actions. The owner mints (or revokes) a read-only
 * link that lets one of their people see their balance with the owner at
 * /share/<token> — no account required. The public read itself happens through
 * the `member_ledger_by_token` SECURITY DEFINER function (migration 0012); these
 * actions only manage tokens, under owner-scoped RLS.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Return an active share token for a member, creating one if none exists. Safe
 * to call repeatedly — it reuses the existing link rather than minting a new one
 * each time, so a shared URL stays stable until explicitly revoked.
 */
export async function createShareLink(input: {
  memberId?: unknown;
}): Promise<ActionResult<{ token: string }>> {
  const memberId =
    typeof input?.memberId === 'string' ? input.memberId.trim() : '';
  if (!UUID_RE.test(memberId)) return { ok: false, error: 'Missing member.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // The member must be the caller's own.
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('owner_id', user.id)
    .single();
  if (!member) return { ok: false, error: 'Member not found.' };

  const { data: existing } = await supabase
    .from('member_share_tokens')
    .select('token')
    .eq('member_id', memberId)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, data: { token: existing.token } };

  const { data, error } = await supabase
    .from('member_share_tokens')
    .insert({ owner_id: user.id, member_id: memberId })
    .select('token')
    .single();
  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.expenses);
  return { ok: true, data: { token: data.token } };
}

/** Revoke a share link so its URL stops resolving. */
export async function revokeShareLink(input: {
  token?: unknown;
}): Promise<ActionResult> {
  const token = typeof input?.token === 'string' ? input.token.trim() : '';
  if (!token) return { ok: false, error: 'Missing link.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { error } = await supabase
    .from('member_share_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.expenses);
  return { ok: true, data: undefined };
}
