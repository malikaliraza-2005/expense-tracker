import { getUser } from '@/lib/auth';
import { expenseMemberLedger } from '@/lib/balances';
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

/**
 * Optional list scoping and filtering. Every field is independent and combines
 * with AND semantics; omitting one leaves that dimension unfiltered.
 */
export interface ExpenseFilter {
  groupId?: string;
  sort?: 'newest' | 'oldest';
  /** Case-insensitive text match on title, description, or notes. */
  search?: string;
  /** Restrict to a single category. */
  categoryId?: number;
  /** Restrict to expenses this member paid for or is a participant in. */
  memberId?: string;
  /** Settlement status. `all` (or omitted) applies no status filter. */
  status?: 'all' | 'outstanding' | 'settled';
  /** Inclusive lower bound on `expense_date` (ISO `yyyy-mm-dd`). */
  from?: string;
  /** Inclusive upper bound on `expense_date` (ISO `yyyy-mm-dd`). */
  to?: string;
}

/**
 * Normalise a raw search term to what actually reaches the database: characters
 * that carry meaning in a PostgREST `or` filter (comma, parens, wildcards) are
 * stripped so user input can't alter the query shape, and whitespace is
 * collapsed. A term that reduces to empty means "no search" — callers use this
 * to decide whether a search is meaningfully active, so a query of only
 * punctuation doesn't masquerade as a filter.
 */
export function normalizeSearchTerm(raw: string | undefined | null): string {
  return (raw ?? '')
    .replace(/[,()*%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A member the owner can split with, for the expense form. */
export interface ScopeMember {
  id: string;
  name: string;
  isSelf: boolean;
  email: string | null;
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
 * Build the choices for the expense form: the self-member id and the scopes the
 * expense can belong to — a general "Everyone" scope (`id: null`) of all the owner's
 * members, plus one scope per group (its members). The form surfaces a scope picker
 * whenever more than one scope exists; picking a group sets `group_id` so the expense
 * lands in that group's ledger (and its per-expense chat). A general expense keeps
 * `group_id` null and splits equally across the chosen people.
 */
export async function getExpenseFormData(): Promise<ExpenseFormData | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = createClient();
  const [selfMemberId, members, { data: groups }, { data: memberships }] =
    await Promise.all([
      getSelfMemberId(),
      getMembers(),
      supabase
        .from('groups')
        .select('id, name')
        .order('created_at', { ascending: false }),
      supabase.from('group_members').select('group_id, member_id'),
    ]);

  const toScopeMember = (m: (typeof members)[number]): ScopeMember => ({
    id: m.id,
    name: m.name,
    isSelf: m.is_self,
    email: m.email,
  });
  const memberById = new Map(members.map((m) => [m.id, m]));

  const everyone: ExpenseScope = {
    id: null,
    label: 'Everyone',
    members: members.map(toScopeMember),
  };

  // One scope per group, its members resolved from the owner's roster. The owner's
  // self-member is always included so they can pay/share even if not an explicit
  // group member.
  const memberIdsByGroup = new Map<string, Set<string>>();
  for (const row of memberships ?? []) {
    const set = memberIdsByGroup.get(row.group_id) ?? new Set<string>();
    set.add(row.member_id);
    memberIdsByGroup.set(row.group_id, set);
  }

  const groupScopes: ExpenseScope[] = (groups ?? []).map((group) => {
    const ids = memberIdsByGroup.get(group.id) ?? new Set<string>();
    if (selfMemberId) ids.add(selfMemberId);
    const scopeMembers = [...ids]
      .map((id) => memberById.get(id))
      .filter((m): m is (typeof members)[number] => Boolean(m))
      .map(toScopeMember);
    return { id: group.id, label: group.name, members: scopeMembers };
  });

  return { selfMemberId, scopes: [everyone, ...groupScopes] };
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
 * Shape raw expense rows into list items: join each to its category, payer, and
 * participant count, dropping any whose category or payer can't be read. Shared
 * by the owner's list and the "Shared with me" list.
 */
async function shapeExpenseList(
  expenses: Expense[],
): Promise<ExpenseListItem[]> {
  if (expenses.length === 0) return [];
  const supabase = createClient();

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
 * The owner's own expenses, each joined to its category, payer, and participant
 * count. Sorted by expense date (newest first by default). Explicitly scoped to
 * `owner_id = auth.uid()` so shared expenses (readable since migration 0015) never
 * leak into the owner's own list/dashboard — those surface only via
 * {@link listSharedWithMe}.
 */
export async function listExpenses(
  filter?: ExpenseFilter,
): Promise<ExpenseListItem[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();

  let query = supabase.from('expenses').select('*').eq('owner_id', user.id);
  if (filter?.groupId) query = query.eq('group_id', filter.groupId);
  if (filter?.categoryId) query = query.eq('category_id', filter.categoryId);
  if (filter?.status === 'outstanding') query = query.is('settled_at', null);
  else if (filter?.status === 'settled') {
    query = query.not('settled_at', 'is', null);
  }
  if (filter?.from) query = query.gte('expense_date', filter.from);
  if (filter?.to) query = query.lte('expense_date', filter.to);

  // Free-text search across the three human-readable fields, sanitised so user
  // input can't alter the PostgREST `or` filter shape.
  const term = normalizeSearchTerm(filter?.search);
  if (term) {
    query = query.or(
      `title.ilike.*${term}*,description.ilike.*${term}*,notes.ilike.*${term}*`,
    );
  }

  const ascending = filter?.sort === 'oldest';
  const { data: allExpenses } = await query
    .order('expense_date', { ascending })
    .order('created_at', { ascending });

  if (!allExpenses || allExpenses.length === 0) return [];

  // "Involving a member" spans two roles: the payer (a column on the expense)
  // and any participant (a row in expense_splits). Resolve the participant side
  // with one scoped read, then keep expenses matching either role.
  let expenses = allExpenses;
  if (filter?.memberId) {
    const memberId = filter.memberId;
    const { data: involvedRows } = await supabase
      .from('expense_splits')
      .select('expense_id')
      .eq('member_id', memberId)
      .in(
        'expense_id',
        allExpenses.map((expense) => expense.id),
      );
    const involved = new Set((involvedRows ?? []).map((row) => row.expense_id));
    expenses = allExpenses.filter(
      (expense) => expense.paid_by === memberId || involved.has(expense.id),
    );
    if (expenses.length === 0) return [];
  }

  return shapeExpenseList(expenses);
}

/**
 * Expenses shared WITH the current user: those they participate in (as payer or
 * split member via their claimed member row) but do NOT own. RLS (migration 0015)
 * already restricts the rows to ones the caller can see; the `neq owner` filter
 * removes their own expenses, leaving exactly the "shared with me" set. Newest
 * first.
 */
export async function listSharedWithMe(): Promise<ExpenseListItem[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .neq('owner_id', user.id)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  return shapeExpenseList((expenses ?? []) as Expense[]);
}

/**
 * Full detail for one expense: fields, category, payer, group, and each
 * participant's share. Returns `null` when the expense isn't visible to the
 * caller (not owned and not shared with them).
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

  // Per-member paid / owed / remaining for this one expense, derived (not stored)
  // from the split set + the expense's own settled flag (migration 0011).
  const figures = new Map(
    expenseMemberLedger({
      amountCents: expense.amount_cents,
      payerId: expense.paid_by,
      splits: (splits ?? []).map((split) => ({
        memberId: split.member_id,
        shareCents: split.share_cents,
      })),
      settled: Boolean(expense.settled_at),
    }).map((figure) => [figure.memberId, figure]),
  );

  const participants: ExpenseParticipant[] = (splits ?? [])
    .map((split) => {
      const member = membersById.get(split.member_id);
      if (!member) return null;
      const figure = figures.get(split.member_id);
      return {
        member,
        shareCents: split.share_cents,
        paidCents: figure?.paidCents ?? 0,
        owedCents: figure?.owedCents ?? split.share_cents,
        remainingCents: figure?.remainingCents ?? 0,
      };
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
