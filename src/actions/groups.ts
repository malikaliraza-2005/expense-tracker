'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  validateCreateGroup,
  validateRenameGroup,
  type CreateGroupFormInput,
  type RenameGroupFormInput,
} from '@/schemas/group.schema';
import type { ActionResult } from '@/types';
import type { Group } from '@/types/db';

/**
 * Group Server Actions. The only place groups and their memberships are written.
 * Every mutation re-validates input and relies on owner-scoped RLS
 * (owner_id = auth.uid(), and group_members scoped through their owning group)
 * as the authorization backstop. Expected failures are returned, never thrown.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuid(value: unknown): string {
  const id = typeof value === 'string' ? value.trim() : '';
  return UUID_RE.test(id) ? id : '';
}

/** Create a group and return the new row. */
export async function createGroup(
  input: CreateGroupFormInput,
): Promise<ActionResult<Group>> {
  const parsed = validateCreateGroup(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid group.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data, error } = await supabase
    .from('groups')
    .insert({ owner_id: user.id, name: parsed.data.name, type: parsed.data.type })
    .select()
    .single();
  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.groups);
  return { ok: true, data };
}

/** Rename / retype a group. */
export async function renameGroup(
  input: RenameGroupFormInput,
): Promise<ActionResult<Group>> {
  const parsed = validateRenameGroup(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid group.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data, error } = await supabase
    .from('groups')
    .update({ name: parsed.data.name, type: parsed.data.type })
    .eq('id', parsed.data.groupId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.groups);
  revalidatePath(`${ROUTES.groups}/${parsed.data.groupId}`);
  return { ok: true, data };
}

/**
 * Delete a group. Any expenses or settlements in it are first UNGROUPED (their
 * `group_id` set to null) so they survive as general activity — otherwise the
 * `on delete cascade` would delete them along with the group. The group's
 * membership rows cascade away on their own.
 */
export async function deleteGroup(input: {
  groupId?: unknown;
}): Promise<ActionResult> {
  const groupId = asUuid(input?.groupId);
  if (!groupId) return { ok: false, error: 'Missing group.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Detach activity so it isn't cascade-deleted with the group.
  await supabase
    .from('expenses')
    .update({ group_id: null })
    .eq('group_id', groupId);
  await supabase
    .from('settlements')
    .update({ group_id: null })
    .eq('group_id', groupId);

  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.groups);
  revalidatePath(ROUTES.expenses);
  return { ok: true, data: undefined };
}

/** Add one of the owner's members to a group (idempotent via the unique index). */
export async function addGroupMember(input: {
  groupId?: unknown;
  memberId?: unknown;
}): Promise<ActionResult> {
  const groupId = asUuid(input?.groupId);
  const memberId = asUuid(input?.memberId);
  if (!groupId || !memberId) return { ok: false, error: 'Missing group or member.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Both the group and the member must belong to the caller.
  const [{ data: group }, { data: member }] = await Promise.all([
    supabase.from('groups').select('id').eq('id', groupId).eq('owner_id', user.id).single(),
    supabase.from('members').select('id').eq('id', memberId).eq('owner_id', user.id).single(),
  ]);
  if (!group || !member) return { ok: false, error: 'Group or member not found.' };

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, member_id: memberId });
  // Ignore a duplicate-membership unique violation — the desired state is met.
  if (error && error.code !== '23505') return { ok: false, error: GENERIC_ERROR };

  revalidateGroupPaths(groupId);
  return { ok: true, data: undefined };
}

/** Remove a member from a group. Their shared expenses are untouched. */
export async function removeGroupMember(input: {
  groupId?: unknown;
  memberId?: unknown;
}): Promise<ActionResult> {
  const groupId = asUuid(input?.groupId);
  const memberId = asUuid(input?.memberId);
  if (!groupId || !memberId) return { ok: false, error: 'Missing group or member.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('member_id', memberId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidateGroupPaths(groupId);
  return { ok: true, data: undefined };
}

/** Revalidate every group sub-route affected by a membership change. */
function revalidateGroupPaths(groupId: string) {
  revalidatePath(`${ROUTES.groups}/${groupId}`);
  revalidatePath(`${ROUTES.groups}/${groupId}/members`);
  revalidatePath(`${ROUTES.groups}/${groupId}/expenses`);
  revalidatePath(`${ROUTES.groups}/${groupId}/balances`);
}
