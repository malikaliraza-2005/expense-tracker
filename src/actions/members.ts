'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  validateAddMember,
  validateRenameMember,
  type AddMemberFormInput,
  type RenameMemberFormInput,
} from '@/schemas/member.schema';
import type { ActionResult } from '@/types';
import type { Member } from '@/types/db';

/**
 * Member Server Actions. The only place the owner's members are written. A
 * member is just a name — no account, email, or invitation. Every mutation
 * re-validates input and relies on owner-scoped RLS (owner_id = auth.uid()) as
 * the authorization backstop. Expected failures are returned, never thrown.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Add a member by name. Saves immediately and returns the new row. */
export async function addMember(
  input: AddMemberFormInput,
): Promise<ActionResult<Member>> {
  const parsed = validateAddMember(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid name.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data, error } = await supabase
    .from('members')
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      email: parsed.data.email,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.expenses);
  return { ok: true, data };
}

/** Rename a member. The owner's self-member can be renamed too. */
export async function renameMember(
  input: RenameMemberFormInput,
): Promise<ActionResult<Member>> {
  const parsed = validateRenameMember(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid name.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data, error } = await supabase
    .from('members')
    .update({ name: parsed.data.name, email: parsed.data.email })
    .eq('id', parsed.data.memberId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.expenses);
  return { ok: true, data };
}

/**
 * Delete a member. Blocked for the owner's self-member, and for any member still
 * referenced by an expense (as payer or participant) or a settlement — deleting
 * them would corrupt those records. History must be cleared first.
 */
export async function deleteMember(input: {
  memberId?: unknown;
}): Promise<ActionResult> {
  const memberId =
    typeof input?.memberId === 'string' ? input.memberId.trim() : '';
  if (!UUID_RE.test(memberId)) return { ok: false, error: 'Missing member.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data: member } = await supabase
    .from('members')
    .select('id, is_self')
    .eq('id', memberId)
    .single();
  if (!member) return { ok: false, error: 'Member not found.' };
  if (member.is_self) {
    return { ok: false, error: 'You cannot delete yourself.' };
  }

  // Guard against orphaning/corrupting history before deleting.
  const [asPayer, asParticipant, asSettler] = await Promise.all([
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('paid_by', memberId),
    supabase
      .from('expense_splits')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId),
    supabase
      .from('settlements')
      .select('id', { count: 'exact', head: true })
      .or(`payer_id.eq.${memberId},receiver_id.eq.${memberId}`),
  ]);

  const referenced =
    (asPayer.count ?? 0) > 0 ||
    (asParticipant.count ?? 0) > 0 ||
    (asSettler.count ?? 0) > 0;
  if (referenced) {
    return {
      ok: false,
      error:
        'This member is part of existing expenses or settlements. Remove those first.',
    };
  }

  const { error } = await supabase.from('members').delete().eq('id', memberId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.expenses);
  return { ok: true, data: undefined };
}
