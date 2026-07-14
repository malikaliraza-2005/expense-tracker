'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { computeSplit, type SplitInput } from '@/lib/splits';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  validateCreateExpense,
  validateUpdateExpense,
  type CreateExpenseFormInput,
  type CreateExpenseInput,
  type SplitInputWire,
  type UpdateExpenseFormInput,
} from '@/schemas/expense.schema';
import { DEFAULT_CURRENCY } from '@/constants/app';
import type { ActionResult } from '@/types';
import type { Expense } from '@/types/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Expense Server Actions (Phase 4). The only place expenses and their splits are
 * written. Every mutation:
 *   1. re-validates the input shape (defense in depth over the client form),
 *   2. re-derives the allowed participant/payer set on the server — group
 *      members for a group expense, or the user + their friends for a personal
 *      one — and rejects anyone outside it,
 *   3. recomputes the concrete integer-cent shares with the split engine
 *      (lib/splits.ts), so a tampered split payload can never persist, and
 *   4. writes the expense + splits atomically via the migration-0005 RPC.
 * RLS is the final backstop under all of this.
 */

type Client = SupabaseClient<Database>;

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** The current user's friend ids (either friendship direction). */
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

/** The member ids of a group (RLS-scoped: empty unless the caller is a member). */
async function getGroupMemberIds(
  supabase: Client,
  groupId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);
  return new Set((data ?? []).map((row) => row.user_id));
}

/** The set of people the current user may involve in `groupId` (or personal). */
async function allowedParticipants(
  supabase: Client,
  userId: string,
  groupId: string | null,
): Promise<{ ok: true; ids: Set<string> } | { ok: false; error: string }> {
  if (groupId) {
    const memberIds = await getGroupMemberIds(supabase, groupId);
    if (!memberIds.has(userId)) {
      return { ok: false, error: 'You are not a member of this group.' };
    }
    return { ok: true, ids: memberIds };
  }
  const friendIds = await getFriendIds(supabase, userId);
  friendIds.add(userId); // a personal expense always includes the user.
  return { ok: true, ids: friendIds };
}

/** All distinct user ids referenced by a wire split (participants). */
function participantIdsOf(split: SplitInputWire): string[] {
  if (split.type === 'equal') return split.participantIds;
  return split.shares.map((share) => share.userId);
}

/** Map a validated wire split to the split engine's input. */
function toSplitInput(split: SplitInputWire, amountCents: number): SplitInput {
  switch (split.type) {
    case 'equal':
      return { type: 'equal', amountCents, userIds: split.participantIds };
    case 'exact':
      return {
        type: 'exact',
        amountCents,
        shares: split.shares.map((s) => ({
          userId: s.userId,
          shareCents: s.amountCents,
        })),
      };
    case 'percentage':
      return {
        type: 'percentage',
        amountCents,
        weights: split.shares.map((s) => ({
          userId: s.userId,
          percent: s.percent,
        })),
      };
  }
}

/**
 * Resolve a validated expense payload to the concrete rows to persist: verifies
 * the payer and every participant are in the allowed set, then computes the
 * exact per-person cent shares. Returns a typed error for any expected failure.
 */
async function resolveSplitRows(
  supabase: Client,
  userId: string,
  data: CreateExpenseInput,
): Promise<
  | { ok: true; splitType: SplitInputWire['type']; rows: Array<{ user_id: string; share_cents: number }> }
  | { ok: false; error: string }
> {
  const allowed = await allowedParticipants(supabase, userId, data.groupId);
  if (!allowed.ok) return allowed;

  if (!allowed.ids.has(data.paidBy)) {
    return { ok: false, error: 'The payer must be a participant you can split with.' };
  }

  const participantIds = participantIdsOf(data.split);
  for (const id of participantIds) {
    if (!allowed.ids.has(id)) {
      return {
        ok: false,
        error: data.groupId
          ? 'Everyone in the split must be a member of this group.'
          : 'You can only split with yourself and your friends.',
      };
    }
  }

  const result = computeSplit(toSplitInput(data.split, data.amountCents));
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    splitType: data.split.type,
    rows: result.shares.map((share) => ({
      user_id: share.userId,
      share_cents: share.shareCents,
    })),
  };
}

/** Revalidate every path a created/edited/deleted expense can appear on. */
function revalidateExpensePaths(groupId: string | null, expenseId?: string) {
  revalidatePath(ROUTES.expenses);
  revalidatePath(ROUTES.dashboard);
  if (expenseId) revalidatePath(`/expenses/${expenseId}`);
  if (groupId) {
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/expenses`);
  }
}

/**
 * Create an expense and its splits. Validates, authorizes the payer and every
 * participant, computes the shares, and writes both rows atomically.
 */
export async function createExpense(
  input: CreateExpenseFormInput,
): Promise<ActionResult<Expense>> {
  const parsed = validateCreateExpense(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid expense.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const resolved = await resolveSplitRows(supabase, user.id, parsed.data);
  if (!resolved.ok) return resolved;

  const { data, error } = await supabase.rpc('create_expense_with_splits', {
    p_group_id: parsed.data.groupId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_amount_cents: parsed.data.amountCents,
    p_currency: DEFAULT_CURRENCY,
    p_category_id: parsed.data.categoryId,
    p_expense_date: parsed.data.expenseDate,
    p_paid_by: parsed.data.paidBy,
    p_notes: parsed.data.notes,
    p_split_type: resolved.splitType,
    p_splits: resolved.rows,
  });

  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  // The function returns a single `expenses` row (RETURNS public.expenses).
  const expense = data as Expense;
  revalidateExpensePaths(parsed.data.groupId, expense.id);
  return { ok: true, data: expense };
}

/**
 * Update an expense and replace its splits. Only the creator can edit (enforced
 * by the RPC's RLS-scoped update + a defensive check here); splits are always
 * recomputed and rewritten atomically.
 */
export async function updateExpense(
  input: UpdateExpenseFormInput,
): Promise<ActionResult<Expense>> {
  const parsed = validateUpdateExpense(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid expense.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Defense in depth over the RPC's RLS: only the creator may edit.
  const { data: existing } = await supabase
    .from('expenses')
    .select('created_by')
    .eq('id', parsed.data.expenseId)
    .single();
  if (!existing) return { ok: false, error: 'Expense not found.' };
  if (existing.created_by !== user.id) {
    return { ok: false, error: 'Only the person who added an expense can edit it.' };
  }

  const resolved = await resolveSplitRows(supabase, user.id, parsed.data);
  if (!resolved.ok) return resolved;

  const { data, error } = await supabase.rpc('update_expense_with_splits', {
    p_expense_id: parsed.data.expenseId,
    p_group_id: parsed.data.groupId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_amount_cents: parsed.data.amountCents,
    p_currency: DEFAULT_CURRENCY,
    p_category_id: parsed.data.categoryId,
    p_expense_date: parsed.data.expenseDate,
    p_paid_by: parsed.data.paidBy,
    p_notes: parsed.data.notes,
    p_split_type: resolved.splitType,
    p_splits: resolved.rows,
  });

  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  const expense = data as Expense;
  revalidateExpensePaths(parsed.data.groupId, expense.id);
  return { ok: true, data: expense };
}

/**
 * Delete an expense. RLS restricts this to the creator; splits cascade via the
 * foreign key, so the balance engine sees the expense fully reversed.
 */
export async function deleteExpense(input: {
  expenseId?: unknown;
}): Promise<ActionResult> {
  const expenseId =
    typeof input?.expenseId === 'string' ? input.expenseId.trim() : '';
  if (!expenseId) return { ok: false, error: 'Missing expense.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Read first so we know the group to revalidate and can re-check ownership.
  const { data: existing } = await supabase
    .from('expenses')
    .select('created_by, group_id')
    .eq('id', expenseId)
    .single();
  if (!existing) return { ok: false, error: 'Expense not found.' };
  if (existing.created_by !== user.id) {
    return { ok: false, error: 'Only the person who added an expense can delete it.' };
  }

  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidateExpensePaths(existing.group_id);
  return { ok: true, data: undefined };
}
