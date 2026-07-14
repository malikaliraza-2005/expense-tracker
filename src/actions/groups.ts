'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  validateCreateGroup,
  validateGroupMember,
  validateUpdateGroup,
  type CreateGroupFormInput,
  type GroupMemberFormInput,
  type UpdateGroupFormInput,
} from '@/schemas/group.schema';
import type { ActionResult } from '@/types';
import type { Group } from '@/types/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Group Server Actions (Phase 3). The only place groups and their membership are
 * written. Every mutation re-checks ownership on the server (defense in depth
 * over RLS), enforces the documented business rules — members come from the
 * owner's friends, the owner cannot be removed, a group with expenses cannot be
 * deleted — and revalidates affected paths.
 */

type Client = SupabaseClient<Database>;

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const UNIQUE_VIOLATION = '23505';

/** The set of the current user's friend ids (either friendship direction). */
async function getFriendIds(
  supabase: Client,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.user_id === userId ? row.friend_id : row.user_id);
  }
  return ids;
}

/** Confirm the current user owns `groupId`. Returns a typed guard result. */
async function assertOwner(
  supabase: Client,
  groupId: string,
  userId: string,
): Promise<
  | { ok: true; createdBy: string }
  | { ok: false; error: string }
> {
  const { data: group } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', groupId)
    .single();

  if (!group) return { ok: false, error: 'Group not found.' };
  if (group.created_by !== userId) {
    return { ok: false, error: 'Only the group owner can do that.' };
  }
  return { ok: true, createdBy: group.created_by };
}

/**
 * Create a group and seed its membership (owner + any chosen friends). Members
 * are filtered to the owner's actual friends. Membership is written in one call
 * after the group so a failure rolls the group back (best-effort atomicity; the
 * only justified DB transaction in the MVP is the expense+splits write).
 */
export async function createGroup(
  input: CreateGroupFormInput,
): Promise<ActionResult<Group>> {
  const parsed = validateCreateGroup(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstError(parsed.errors) ?? 'Invalid group details.',
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const friendIds = await getFriendIds(supabase, user.id);
  const memberIds = parsed.data.memberIds.filter(
    (id) => id !== user.id && friendIds.has(id),
  );

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: parsed.data.name, type: parsed.data.type, created_by: user.id })
    .select()
    .single();
  if (groupError || !group) return { ok: false, error: GENERIC_ERROR };

  const memberRows = [
    { group_id: group.id, user_id: user.id, role: 'owner' },
    ...memberIds.map((id) => ({
      group_id: group.id,
      user_id: id,
      role: 'member',
    })),
  ];

  const { error: membersError } = await supabase
    .from('group_members')
    .insert(memberRows);
  if (membersError) {
    // Roll back the orphaned group so the user can retry cleanly.
    await supabase.from('groups').delete().eq('id', group.id);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(ROUTES.groups);
  return { ok: true, data: group };
}

/** Rename a group and/or change its type. Owner only. */
export async function updateGroup(
  input: UpdateGroupFormInput,
): Promise<ActionResult<Group>> {
  const parsed = validateUpdateGroup(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstError(parsed.errors) ?? 'Invalid group details.',
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const owner = await assertOwner(supabase, parsed.data.groupId, user.id);
  if (!owner.ok) return owner;

  // Partial update: only send fields the caller supplied.
  const updates: { name?: string; type?: Group['type'] } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.type !== undefined) updates.type = parsed.data.type;

  const { data: group, error } = await supabase
    .from('groups')
    .update(updates)
    .eq('id', parsed.data.groupId)
    .select()
    .single();
  if (error || !group) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.groups);
  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true, data: group };
}

/** Delete a group. Owner only; blocked while the group has expenses. */
export async function deleteGroup(input: {
  groupId?: unknown;
}): Promise<ActionResult> {
  const groupId =
    typeof input?.groupId === 'string' ? input.groupId.trim() : '';
  if (!groupId) return { ok: false, error: 'Missing group.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const owner = await assertOwner(supabase, groupId, user.id);
  if (!owner.ok) return owner;

  const { count } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);
  if (count && count > 0) {
    return {
      ok: false,
      error:
        'This group still has expenses. Delete or settle them before deleting the group.',
    };
  }

  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(ROUTES.groups);
  return { ok: true, data: undefined };
}

/** Add one of the owner's friends to a group. Owner only. */
export async function addGroupMember(
  input: GroupMemberFormInput,
): Promise<ActionResult> {
  const parsed = validateGroupMember(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid request.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const owner = await assertOwner(supabase, parsed.data.groupId, user.id);
  if (!owner.ok) return owner;

  const friendIds = await getFriendIds(supabase, user.id);
  if (!friendIds.has(parsed.data.userId)) {
    return { ok: false, error: 'You can only add people from your friends list.' };
  }

  const { error } = await supabase.from('group_members').insert({
    group_id: parsed.data.groupId,
    user_id: parsed.data.userId,
    role: 'member',
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: 'They are already in this group.' };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  // Refresh the groups list too — its cards show the member count.
  revalidatePath(ROUTES.groups);
  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath(`/groups/${parsed.data.groupId}/members`);
  return { ok: true, data: undefined };
}

/** Remove a member from a group. Owner only; the owner cannot be removed. */
export async function removeGroupMember(
  input: GroupMemberFormInput,
): Promise<ActionResult> {
  const parsed = validateGroupMember(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid request.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const owner = await assertOwner(supabase, parsed.data.groupId, user.id);
  if (!owner.ok) return owner;

  if (parsed.data.userId === owner.createdBy) {
    return { ok: false, error: 'The group owner cannot be removed.' };
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', parsed.data.groupId)
    .eq('user_id', parsed.data.userId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  // Refresh the groups list too — its cards show the member count.
  revalidatePath(ROUTES.groups);
  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath(`/groups/${parsed.data.groupId}/members`);
  return { ok: true, data: undefined };
}
