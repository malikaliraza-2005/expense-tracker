'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { safeCurrency } from '@/constants/currencies';
import {
  getLinkedMembers,
  getLinkedUserIds,
  logActivity,
} from '@/lib/activity-log';
import { computeSplit, recomputeEqualAfterRemoval } from '@/lib/splits';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  validateCreateExpense,
  validateUpdateExpense,
  type CreateExpenseFormInput,
  type CreateExpenseInput,
  type UpdateExpenseFormInput,
} from '@/schemas/expense.schema';
import type { ActionResult } from '@/types';
import type { Expense } from '@/types/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Expense Server Actions. The only place expenses and their splits are written.
 * Every mutation:
 *   1. re-validates the input shape,
 *   2. re-derives the allowed member set on the server — a group's members for a
 *      group expense, or all of the owner's members otherwise — and rejects any
 *      payer/participant outside it,
 *   3. computes the concrete equal integer-cent shares with the split engine, and
 *   4. writes the expense + splits atomically via the migration-0010 RPC (which
 *      also re-verifies ownership of every referenced id).
 */

type Client = SupabaseClient<Database>;

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/**
 * The account's currency, from the owner's profile. Single-currency-per-account:
 * every amount the owner records is stored in this currency (the same one the UI
 * displays in), rather than a hardcoded default.
 */
async function getOwnerCurrency(
  supabase: Client,
  ownerId: string,
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('preferred_currency')
    .eq('id', ownerId)
    .single();
  return safeCurrency(data?.preferred_currency);
}

/** All of the owner's member ids. */
async function getOwnerMemberIds(
  supabase: Client,
  ownerId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('members')
    .select('id')
    .eq('owner_id', ownerId);
  return new Set((data ?? []).map((row) => row.id));
}

/** The member ids belonging to a group (owner-scoped via RLS). */
async function getGroupMemberIds(
  supabase: Client,
  groupId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('group_members')
    .select('member_id')
    .eq('group_id', groupId);
  return new Set((data ?? []).map((row) => row.member_id));
}

/** The owner's self-member id (the "You" participant), or null. */
async function getSelfMemberId(
  supabase: Client,
  ownerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('is_self', true)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * The members the owner may involve for `groupId` (or all members otherwise).
 *
 * For a group, that's the group's members PLUS the owner's own self-member: the owner
 * always participates in their own group's expenses (they're usually the payer), even
 * without an explicit `group_members` row. This mirrors the expense form's group scope
 * — which offers "You" — so the form and this server-side guard agree on who's allowed.
 */
async function allowedMembers(
  supabase: Client,
  ownerId: string,
  groupId: string | null,
): Promise<{ ok: true; ids: Set<string> } | { ok: false; error: string }> {
  if (groupId) {
    const ids = await getGroupMemberIds(supabase, groupId);
    if (ids.size === 0) {
      return { ok: false, error: 'That group has no members.' };
    }
    const selfId = await getSelfMemberId(supabase, ownerId);
    if (selfId) ids.add(selfId);
    return { ok: true, ids };
  }
  return { ok: true, ids: await getOwnerMemberIds(supabase, ownerId) };
}

/**
 * Resolve a validated expense payload to the concrete split rows to persist:
 * verifies the payer and every participant are allowed, then computes the equal
 * per-person cent shares.
 */
async function resolveSplitRows(
  supabase: Client,
  ownerId: string,
  data: CreateExpenseInput,
): Promise<
  | { ok: true; rows: Array<{ member_id: string; share_cents: number }> }
  | { ok: false; error: string }
> {
  const allowed = await allowedMembers(supabase, ownerId, data.groupId);
  if (!allowed.ok) return allowed;

  if (!allowed.ids.has(data.paidBy)) {
    return {
      ok: false,
      error: data.groupId
        ? 'The payer must be a member of this group.'
        : 'The payer must be one of your members.',
    };
  }

  for (const id of data.memberIds) {
    if (!allowed.ids.has(id)) {
      return {
        ok: false,
        error: data.groupId
          ? 'Everyone sharing the expense must be a member of this group.'
          : 'Everyone sharing the expense must be one of your members.',
      };
    }
  }

  const result = computeSplit({
    type: 'equal',
    amountCents: data.amountCents,
    userIds: data.memberIds,
  });
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    rows: result.shares.map((share) => ({
      member_id: share.userId,
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
    revalidatePath(`/groups/${groupId}/members`);
    revalidatePath(`/groups/${groupId}/balances`);
  }
}

/** Create an expense and its equal splits, atomically. */
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

  const currency = await getOwnerCurrency(supabase, user.id);

  const { data, error } = await supabase.rpc('create_expense_with_splits', {
    p_group_id: parsed.data.groupId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_amount_cents: parsed.data.amountCents,
    p_currency: currency,
    p_category_id: parsed.data.categoryId,
    p_expense_date: parsed.data.expenseDate,
    p_paid_by: parsed.data.paidBy,
    p_notes: parsed.data.notes,
    p_split_type: 'equal',
    p_splits: resolved.rows,
  });

  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  const expense = data as Expense;
  revalidateExpensePaths(parsed.data.groupId, expense.id);

  // Activity: "You added …" on my feed, "… added you to … — you owe X" on each linked
  // participant's feed. Each recipient gets THEIR figure, so the notification says
  // what it means for them rather than making them open the expense to find out.
  // Best-effort — never fails the write.
  const linked = await getLinkedMembers(
    supabase,
    resolved.rows.map((row) => row.member_id),
    user.id,
  );
  await logActivity(supabase, [
    {
      ownerId: user.id,
      type: 'expense_created',
      subject: parsed.data.title,
      expenseId: expense.id,
      groupId: parsed.data.groupId,
    },
    ...linked.map((entry) => ({
      ownerId: entry.userId,
      type: 'expense_added_you' as const,
      subject: parsed.data.title,
      expenseId: expense.id,
      groupId: parsed.data.groupId,
      amountCents: netOnExpense(entry.memberId, parsed.data, resolved.rows),
      currency,
    })),
  ]);

  return { ok: true, data: expense };
}

/**
 * What an expense means for one participant, signed the way balances are everywhere
 * else: **negative = they owe**, positive = they're owed. A non-payer owes their
 * share; the payer fronted the whole amount, so they're owed everything but their own
 * share. 0 when they neither owe nor are owed (e.g. they paid and shared it alone).
 */
function netOnExpense(
  memberId: string,
  data: CreateExpenseInput,
  rows: Array<{ member_id: string; share_cents: number }>,
): number {
  const share = rows.find((row) => row.member_id === memberId)?.share_cents ?? 0;
  return memberId === data.paidBy ? data.amountCents - share : -share;
}

/** Update an expense and replace its splits, atomically. */
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

  const resolved = await resolveSplitRows(supabase, user.id, parsed.data);
  if (!resolved.ok) return resolved;

  const currency = await getOwnerCurrency(supabase, user.id);

  const { data, error } = await supabase.rpc('update_expense_with_splits', {
    p_expense_id: parsed.data.expenseId,
    p_group_id: parsed.data.groupId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_amount_cents: parsed.data.amountCents,
    p_currency: currency,
    p_category_id: parsed.data.categoryId,
    p_expense_date: parsed.data.expenseDate,
    p_paid_by: parsed.data.paidBy,
    p_notes: parsed.data.notes,
    p_split_type: 'equal',
    p_splits: resolved.rows,
  });

  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  const expense = data as Expense;
  revalidateExpensePaths(parsed.data.groupId, expense.id);

  // Activity: "You edited …" on my feed, "… edited …" on each linked participant's.
  const linked = await getLinkedUserIds(
    supabase,
    resolved.rows.map((row) => row.member_id),
    user.id,
  );
  await logActivity(supabase, [
    {
      ownerId: user.id,
      type: 'expense_updated',
      subject: parsed.data.title,
      expenseId: expense.id,
      groupId: parsed.data.groupId,
    },
    ...linked.map((uid) => ({
      ownerId: uid,
      type: 'expense_updated' as const,
      subject: parsed.data.title,
      expenseId: expense.id,
      groupId: parsed.data.groupId,
    })),
  ]);

  return { ok: true, data: expense };
}

/**
 * Remove one participant from an expense and recompute the equal split across
 * everyone who remains. Reuses the atomic `update_expense_with_splits` RPC
 * (migration 0010) rather than a bespoke delete: it re-writes the whole split
 * set in one call and re-verifies ownership of every id, so no new migration is
 * needed. The expense's other fields (including its manual settled flag) are
 * preserved unchanged — the RPC only touches the columns it's given.
 *
 * Guards live in {@link recomputeEqualAfterRemoval}: the payer can't be removed
 * (they can't owe themselves) and at least two participants must remain.
 */
export async function removeExpenseMember(input: {
  expenseId?: unknown;
  memberId?: unknown;
}): Promise<ActionResult> {
  const expenseId =
    typeof input?.expenseId === 'string' ? input.expenseId.trim() : '';
  const memberId =
    typeof input?.memberId === 'string' ? input.memberId.trim() : '';
  if (!expenseId) return { ok: false, error: 'Missing expense.' };
  if (!memberId) return { ok: false, error: 'Missing member.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Load the expense (owner-scoped by RLS) and its current split members.
  const [{ data: expense }, { data: splitRows }] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single<Expense>(),
    supabase
      .from('expense_splits')
      .select('member_id')
      .eq('expense_id', expenseId),
  ]);
  if (!expense) return { ok: false, error: 'Expense not found.' };

  const memberIds = (splitRows ?? []).map((row) => row.member_id);
  const recomputed = recomputeEqualAfterRemoval({
    amountCents: expense.amount_cents,
    memberIds,
    removeId: memberId,
    payerId: expense.paid_by,
  });
  if (!recomputed.ok) return { ok: false, error: recomputed.error };

  // Re-write the split set atomically, preserving every other expense field.
  const { error } = await supabase.rpc('update_expense_with_splits', {
    p_expense_id: expense.id,
    p_group_id: expense.group_id,
    p_title: expense.title,
    p_description: expense.description,
    p_amount_cents: expense.amount_cents,
    p_currency: expense.currency,
    p_category_id: expense.category_id,
    p_expense_date: expense.expense_date,
    p_paid_by: expense.paid_by,
    p_notes: expense.notes,
    p_split_type: 'equal',
    p_splits: recomputed.shares.map((share) => ({
      member_id: share.userId,
      share_cents: share.shareCents,
    })),
  });
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidateExpensePaths(expense.group_id, expense.id);
  return { ok: true, data: undefined };
}

/**
 * Mark an expense settled or outstanding (manual per-expense flag, migration
 * 0011). Plain UPDATE without RETURNING — RLS scopes it to the owner and avoids
 * the RETURNING/RLS interaction noted in migration 0009. Idempotent.
 */
export async function setExpenseSettled(input: {
  expenseId?: unknown;
  settled?: unknown;
}): Promise<ActionResult> {
  const expenseId =
    typeof input?.expenseId === 'string' ? input.expenseId.trim() : '';
  if (!expenseId) return { ok: false, error: 'Missing expense.' };
  const settled = input?.settled === true;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data: existing } = await supabase
    .from('expenses')
    .select('group_id')
    .eq('id', expenseId)
    .single();
  if (!existing) return { ok: false, error: 'Expense not found.' };

  const { error } = await supabase
    .from('expenses')
    .update({ settled_at: settled ? new Date().toISOString() : null })
    .eq('id', expenseId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidateExpensePaths(existing.group_id, expenseId);
  return { ok: true, data: undefined };
}

/** Delete an expense. Splits cascade; the balance engine sees it fully reversed. */
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

  // Capture the title + participants BEFORE deleting (splits cascade away) so the
  // activity can name the expense and reach everyone who was on it.
  const [{ data: existing }, { data: splitRows }] = await Promise.all([
    supabase.from('expenses').select('group_id, title').eq('id', expenseId).single(),
    supabase.from('expense_splits').select('member_id').eq('expense_id', expenseId),
  ]);
  if (!existing) return { ok: false, error: 'Expense not found.' };
  const linked = await getLinkedUserIds(
    supabase,
    (splitRows ?? []).map((row) => row.member_id),
    user.id,
  );

  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidateExpensePaths(existing.group_id);

  // Activity: "You deleted …" / "… deleted …". No expense_id — the row is gone; the
  // title lives on in `subject`.
  await logActivity(supabase, [
    { ownerId: user.id, type: 'expense_deleted', subject: existing.title, groupId: existing.group_id },
    ...linked.map((uid) => ({
      ownerId: uid,
      type: 'expense_deleted' as const,
      subject: existing.title,
      groupId: existing.group_id,
    })),
  ]);

  return { ok: true, data: undefined };
}
