import { getUser } from '@/lib/auth';
import { getSelfMemberId } from '@/lib/queries/balances';
import { getMembers } from '@/lib/queries/members';
import { createClient } from '@/lib/supabase/server';
import type {
  ExpenseDetail,
  ExpenseListItem,
  ExpenseParticipant,
} from '@/types/dto';
import type { Category, Expense, Member, SplitType } from '@/types/db';

/**
 * Expense reads. Typed data-access over the owner-scoped `expenses` /
 * `expense_splits` tables, joined to `categories` and `members`. RLS scopes
 * everything to the owner.
 */

/** Optional list scoping. `groupId` restricts to one group; `sort` by date. */
export interface ExpenseFilter {
  groupId?: string;
  sort?: 'newest' | 'oldest';
}

/** A member the owner can split with, for the expense form. */
export interface ScopeMember {
  id: string;
  name: string;
  isSelf: boolean;
}

/** A scope an expense can belong to: general (`id: null`) or a group. */
export interface ExpenseScope {
  id: string | null;
  label: string;
  members: ScopeMember[];
}

/** Everything the add/edit expense form needs to render its choices. */
export interface ExpenseFormData {
  selfMemberId: string | null;
  scopes: ExpenseScope[];
}

/**
 * Build the choices for the expense form: the self-member id plus a single
 * "Everyone" scope containing all of the owner's members. (Groups were removed
 * from the product; expenses are shared among the owner's members directly.)
 */
export async function getExpenseFormData(): Promise<ExpenseFormData | null> {
  const user = await getUser();
  if (!user) return null;

  const [selfMemberId, members] = await Promise.all([
    getSelfMemberId(),
    getMembers(),
  ]);

  const everyone: ExpenseScope = {
    id: null,
    label: 'Everyone',
    members: members.map((m) => ({ id: m.id, name: m.name, isSelf: m.is_self })),
  };

  return { selfMemberId, scopes: [everyone] };
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

/** Fetch member rows for a set of ids, keyed by id. */
async function fetchMembersById(ids: string[]): Promise<Map<string, Member>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase.from('members').select('*').in('id', ids);
  return new Map((data ?? []).map((member) => [member.id, member]));
}

/**
 * Expenses visible to the owner, each joined to its category, payer, and
 * participant count. Sorted by expense date (newest first by default).
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

  // These three reads are independent — run them concurrently rather than in a
  // waterfall so the list resolves in one round-trip's worth of latency.
  const [categoriesById, payersById, { data: splitRows }] = await Promise.all([
    fetchCategoriesById([
      ...new Set(expenses.map((expense) => expense.category_id)),
    ]),
    fetchMembersById([...new Set(expenses.map((expense) => expense.paid_by))]),
    supabase
      .from('expense_splits')
      .select('expense_id')
      .in(
        'expense_id',
        expenses.map((expense) => expense.id),
      ),
  ]);

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
    if (!category || !payer) continue;
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
 * participant's share. Returns `null` when the expense is not the owner's.
 */
export async function getExpense(
  expenseId: string,
): Promise<ExpenseDetail | null> {
  const supabase = createClient();

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single<Expense>();
  if (!expense) return null;

  const { data: splits } = await supabase
    .from('expense_splits')
    .select('member_id, share_cents, split_type')
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

  const participantIds = (splits ?? []).map((split) => split.member_id);
  const membersById = await fetchMembersById([
    expense.paid_by,
    ...participantIds,
  ]);

  const payer = membersById.get(expense.paid_by);
  if (!payer) return null;

  const participants: ExpenseParticipant[] = (splits ?? [])
    .map((split) => {
      const member = membersById.get(split.member_id);
      if (!member) return null;
      return { member, shareCents: split.share_cents };
    })
    .filter((entry): entry is ExpenseParticipant => entry !== null)
    .sort((a, b) => a.member.name.localeCompare(b.member.name));

  const splitType: SplitType = splits?.[0]?.split_type ?? 'equal';

  return {
    expense,
    category,
    payer,
    group: group ?? null,
    participants,
    splitType,
  };
}
