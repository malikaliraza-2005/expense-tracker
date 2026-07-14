'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  validateAddFriend,
  type AddFriendFormInput,
} from '@/schemas/friend.schema';
import type { ActionResult } from '@/types';
import type { Profile } from '@/types/db';

/**
 * Friend Server Actions (Phase 3). The only place friend links are written.
 *
 * Each action re-validates input on the server, re-checks the business rules
 * (registered account, no self-friend, no duplicate link) that RLS alone cannot
 * express, performs the write, and revalidates. Expected failures are returned
 * as `ActionResult`, never thrown across the boundary.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/**
 * Link the current user to an existing account by email. Errors clearly when no
 * account matches, when the caller targets themselves, or when the link already
 * exists (in either direction).
 */
export async function addFriend(
  input: AddFriendFormInput,
): Promise<ActionResult<Profile>> {
  const parsed = validateAddFriend(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid email.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Resolve email → profile id via the SECURITY DEFINER lookup (migration 0007);
  // `profiles` stores no email, so this is the only way to find the account.
  const { data: friendId, error: lookupError } = await supabase.rpc(
    'find_profile_by_email',
    { lookup_email: parsed.data.email },
  );
  if (lookupError) return { ok: false, error: GENERIC_ERROR };
  if (!friendId) {
    return { ok: false, error: 'No account found for that email.' };
  }
  if (friendId === user.id) {
    return { ok: false, error: 'You cannot add yourself as a friend.' };
  }

  // Pre-check for an existing link in either direction (unique constraint only
  // covers one direction, so a pre-check is required — phase-3 §3).
  const { data: existing } = await supabase
    .from('friendships')
    .select('id')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${friendId}),` +
        `and(user_id.eq.${friendId},friend_id.eq.${user.id})`,
    )
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: false, error: 'You are already friends with this person.' };
  }

  const { error: insertError } = await supabase
    .from('friendships')
    .insert({ user_id: user.id, friend_id: friendId, status: 'accepted' });
  if (insertError) return { ok: false, error: GENERIC_ERROR };

  const { data: friend } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', friendId)
    .single<Profile>();
  if (!friend) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.friends);
  return { ok: true, data: friend };
}

/** Remove the friend link between the current user and `friendId` (either row). */
export async function removeFriend(input: {
  friendId?: unknown;
}): Promise<ActionResult> {
  const friendId =
    typeof input?.friendId === 'string' ? input.friendId.trim() : '';
  if (!UUID_RE.test(friendId)) return { ok: false, error: 'Missing friend.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${friendId}),` +
        `and(user_id.eq.${friendId},friend_id.eq.${user.id})`,
    );
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.friends);
  return { ok: true, data: undefined };
}
