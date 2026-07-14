import { getFriends } from '@/lib/queries/friends';
import { getGroupMembers, getGroups } from '@/lib/queries/groups';
import { createClient } from '@/lib/supabase/server';
import type {
  ExpenseDetail,
  ExpenseListItem,
  ExpenseParticipant,
} from '@/types/dto';
import type { Category, Expense, Profile, SplitType } from '@/types/db';

/**
 * Expense reads (Phase 4). Typed data-access over the RLS-scoped `expenses` /
 * `expense_splits` tables, joined to `categories` and `profiles`. RLS does the
 * scoping — these return only expenses the caller may see (group members,
 * personal parties, or split participants) — so no membership re-filtering is
 * needed here.
 *
 * Sort/scoping is supported for the list; richer filtering (by category,
 * member, amount) is scaffolded for Phase 6.
 */

/** Optional list scoping. `groupId` restricts to one group; `sort` by date. */
export interface ExpenseFilter {
  /** Restrict to a single group's expenses. */
  groupId?: string;
  /** Date sort direction. Defaults to newest first. */
  sort?: 'newest' | 'oldest';
}

/** A person the current user can split with, for the expense form. */
export interface ScopePerson {
  id: string;
  name: string;
}

/** A scope an expense can belong to: personal (`id: null`) or a group. */
export interface ExpenseScope {
  id: string | null;
  label: string;
  people: ScopePerson[];
}

/** Everything the add/edit expense form needs to render its scope choices. */
export interface ExpenseFormData {
  currentUserId: string;
  scopes: ExpenseScope[];
}

/**
 * Build the scope choices for the expense form: a "Personal" scope (the user +
 * their friends) plus one scope per group the user belongs to (its members).
 * Reuses the friends/groups data-access rather than re-querying membership.
 */
export async function getExpenseFormData(): Promise<ExpenseFormData | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const nameFor = (id: string, fullName: string | null) =>
    id === user.id ? 'You' : fullName || 'Unnamed';

  const [friends, groups] = await Promise.all([getFriends(), getGroups()]);

  const personal: ExpenseScope = {
    id: null,
    label: 'Personal',
    people: [
      { id: user.id, name: 'You' },
      ...friends.map((friend) => ({
        id: friend.profile.id,
        name: friend.profile.full_name || 'Unnamed',
      })),
    ],
  };

  const groupScopes: ExpenseScope[] = [];
  for (const { group } of groups) {
    const members = await getGroupMembers(group.id);
    groupScopes.push({
      id: group.id,
      label: group.name,
      people: members.map((member) => ({
        id: member.userId,
        name: nameFor(member.userId, member.profile.full_name),
      })),
    });
  }

  return { currentUserId: user.id, scopes: [personal, ...groupScopes] };
}

/** Fetch category rows for a set of ids, keyed by id. */
async function fetchCategoriesById(
  ids: number[],
): Promise<Map<number, Category>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase.from('categories').select('*').in('id', ids);
  return new Map((data ?? []).map((category) => [category.id, category]));
}

/** Fetch profile rows for a set of ids, keyed by id. */
async function fetchProfilesById(
  ids: string[],
): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').in('id', ids);
  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

/**
 * Expenses visible to the current user, each joined to its category, payer, and
 * participant count. Sorted by expense date (newest first by default), then by
 * creation time for a stable order within a day.
 */
export async function listExpenses(
  filter?: ExpenseFilter,
): Promise<ExpenseListItem[]> {
  const supabase = createClient();

  let query = supabase.from('expenses').select('*');
  if (filter?.groupId) query = query.eq('group_id', filter.groupId);

  const ascending = filter?.sort === 'oldest';
  const { data: expenses } = await query
    .order('expense_date', { ascending })
    .order('created_at', { ascending });

  if (!expenses || expenses.length === 0) return [];

  const categoriesById = await fetchCategoriesById([
    ...new Set(expenses.map((expense) => expense.category_id)),
  ]);
  const payersById = await fetchProfilesById([
    ...new Set(expenses.map((expense) => expense.paid_by)),
  ]);

  const { data: splitRows } = await supabase
    .from('expense_splits')
    .select('expense_id')
    .in(
      'expense_id',
      expenses.map((expense) => expense.id),
    );

  const countByExpense = new Map<string, number>();
  for (const row of splitRows ?? []) {
    countByExpense.set(
      row.expense_id,
      (countByExpense.get(row.expense_id) ?? 0) + 1,
    );
  }

  const items: ExpenseListItem[] = [];
  for (const expense of expenses) {
    const category = categoriesById.get(expense.category_id);
    const payer = payersById.get(expense.paid_by);
    if (!category || !payer) continue; // skip rows we can't fully resolve
    items.push({
      expense,
      category,
      payer,
      participantCount: countByExpense.get(expense.id) ?? 0,
    });
  }
  return items;
}

/**
 * Full detail for one expense: fields, category, payer, group, and each
 * participant's share. Returns `null` when the expense is not visible to the
 * caller (RLS-hidden or nonexistent).
 */
export async function getExpense(
  expenseId: string,
): Promise<ExpenseDetail | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single<Expense>();
  if (!expense) return null;

  const { data: splits } = await supabase
    .from('expense_splits')
    .select('user_id, share_cents, split_type')
    .eq('expense_id', expenseId);

  const [categoriesById, group] = await Promise.all([
    fetchCategoriesById([expense.category_id]),
    expense.group_id
      ? supabase
          .from('groups')
          .select('*')
          .eq('id', expense.group_id)
          .single()
          .then(({ data }) => data)
      : Promise.resolve(null),
  ]);

  const category = categoriesById.get(expense.category_id);
  if (!category) return null;

  const participantIds = (splits ?? []).map((split) => split.user_id);
  const profilesById = await fetchProfilesById([
    expense.paid_by,
    ...participantIds,
  ]);

  const payer = profilesById.get(expense.paid_by);
  if (!payer) return null;

  const participants: ExpenseParticipant[] = (splits ?? [])
    .map((split) => {
      const profile = profilesById.get(split.user_id);
      if (!profile) return null;
      return { profile, shareCents: split.share_cents };
    })
    .filter((entry): entry is ExpenseParticipant => entry !== null)
    .sort((a, b) =>
      (a.profile.full_name || '').localeCompare(b.profile.full_name || ''),
    );

  const splitType: SplitType = splits?.[0]?.split_type ?? 'equal';

  return {
    expense,
    category,
    payer,
    group: group ?? null,
    participants,
    splitType,
    isOwner: expense.created_by === user.id,
  };
}
