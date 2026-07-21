import { getUser } from '@/lib/auth';
import { expenseMemberLedger } from '@/lib/balances';
import { getSelfMemberId } from '@/lib/queries/balances';
import { listCategories } from '@/lib/queries/categories';
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

/** A group scope an expense can belong to. Every expense belongs to a group. */
export interface ExpenseScope {
  id: string;
  label: string;
  members: ScopeMember[];
}

/** Everything the add/edit expense form needs to render its choices. */
export interface ExpenseFormData {
  selfMemberId: string | null;
  /** The owner's Personal group — the default scope for a quick add. */
  personalGroupId: string | null;
  scopes: ExpenseScope[];
  /** The owner's full roster — for adding people inline / creating a group inline. */
  allMembers: ScopeMember[];
}

/**
 * Build the choices for the expense form: the self-member id, the owner's Personal
 * group (the quick-add default), and one scope per group (its members). Every expense
 * belongs to a group now — there is no ungrouped scope. Picking a group sets `group_id`
 * so the expense lands in that group's ledger (and its per-expense chat) and splits
 * equally across the chosen members. The owner's self-member is always available so
 * they can pay/share even without an explicit `group_members` row.
 */
export async function getExpenseFormData(): Promise<ExpenseFormData | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = createClient();
  // Guarantee the owner has a Personal group before reading the group list, so the
  // scope picker is never empty and a first-ever expense has a home.
  const { data: personalGroupId } = await supabase.rpc('ensure_personal_group');

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

  return {
    selfMemberId,
    personalGroupId: (personalGroupId as string | null) ?? null,
    scopes: groupScopes,
    allMembers: members.map(toScopeMember),
  };
}

/**
 * Category rows for a set of ids, keyed by id. Categories are a small, static
 * seed table, so this reads the full set through the request-cached
 * `listCategories()` and filters in memory rather than issuing a fresh `in()`
 * query at every call site — the list and detail paths then share one read.
 */
async function fetchCategoriesById(
  ids: number[],
): Promise<Map<number, Category>> {
  if (ids.length === 0) return new Map();
  const wanted = new Set(ids);
  const all = await listCategories();
  return new Map(
    all.filter((category) => wanted.has(category.id)).map((c) => [c.id, c]),
  );
}

/** Fetch member rows for a set of ids, keyed by id. */
async function fetchMembersById(ids: string[]): Promise<Map<string, Member>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase.from('members').select('*').in('id', ids);
  return new Map((data ?? []).map((member) => [member.id, member]));
}

/** Payment-derived settlement standing for one expense (migration 0031). */
interface ExpenseSettlementStatus {
  /** Fully covered by allocated payments — one input to the effective settled flag. */
  fullySettled: boolean;
  /** How much of each debtor's share is settled, keyed by member id. */
  settledByMember: Record<string, number>;
}

/**
 * Aggregate settlement standing for a set of expenses, computed from the OWNER's
 * complete ledger by the `expense_settlement_status` RPC (migration 0031) so that a
 * shared participant derives the SAME status the owner sees — including payments made
 * by a third party they can't see as settlement rows.
 *
 * Degrades gracefully: if the RPC isn't present (migration 0031 not yet applied) the
 * call errors and this returns an empty map, so callers fall back to the manual
 * `settled_at` flag and nothing breaks.
 */
export async function fetchSettlementStatus(
  expenseIds: string[],
): Promise<Map<string, ExpenseSettlementStatus>> {
  if (expenseIds.length === 0) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.rpc('expense_settlement_status', {
    p_expense_ids: expenseIds,
  });
  if (error || !data) return new Map();
  return new Map(
    data.map((row) => [
      row.expense_id,
      {
        fullySettled: row.fully_settled,
        settledByMember: row.settled_by_member ?? {},
      },
    ]),
  );
}

/**
 * Shape raw expense rows into list items: join each to its category, payer, and
 * participant count, dropping any whose category or payer can't be read.
 *
 * The rows a caller can see span their own expenses and any shared with them as a
 * participant (0015), and both are listed together — so each item is marked with
 * `isOwn`, and a shared one carries `addedByName` (the other account's display name,
 * read from their self-member) so the UI can say whose it is. Without that the two
 * would be indistinguishable in one list.
 */
export async function shapeExpenseList(
  expenses: Expense[],
): Promise<ExpenseListItem[]> {
  if (expenses.length === 0) return [];
  const user = await getUser();
  const supabase = createClient();

  // Owners other than me — only these need a name resolved.
  const otherOwnerIds = [
    ...new Set(
      expenses
        .map((expense) => expense.owner_id)
        .filter((ownerId) => ownerId !== user?.id),
    ),
  ];

  // These reads are independent — run them concurrently rather than in a
  // waterfall so the list resolves in one round-trip's worth of latency.
  const [
    categoriesById,
    payersById,
    { data: splitRows },
    ownerNameById,
    statusById,
    groupNameById,
  ] = await Promise.all([
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
      fetchOwnerNamesById(otherOwnerIds),
      // Payment-derived settled state (0031) so a list row reads settled the same on
      // every account. Empty when the migration isn't applied → manual flag stands.
      fetchSettlementStatus(expenses.map((expense) => expense.id)),
      fetchGroupNamesById([
        ...new Set(
          expenses
            .map((expense) => expense.group_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ]),
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
    const isOwn = expense.owner_id === user?.id;
    items.push({
      expense,
      category,
      payer,
      participantCount: countByExpense.get(expense.id) ?? 0,
      groupName: expense.group_id
        ? (groupNameById.get(expense.group_id) ?? null)
        : null,
      isOwn,
      addedByName: isOwn ? null : (ownerNameById.get(expense.owner_id) ?? null),
      fullySettled:
        Boolean(expense.settled_at) ||
        Boolean(statusById.get(expense.id)?.fullySettled),
    });
  }
  return items;
}

/**
 * Display names for other accounts that own expenses shared with the caller, keyed by
 * account id. An account's name lives on its self-member, which is readable here
 * because they share an expense with the caller (0015 `can_see_member`); a name that
 * can't be read simply degrades to null.
 */
async function fetchOwnerNamesById(
  ownerIds: string[],
): Promise<Map<string, string>> {
  if (ownerIds.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase
    .from('members')
    .select('owner_id, name')
    .in('owner_id', ownerIds)
    .eq('is_self', true);
  return new Map((data ?? []).map((member) => [member.owner_id, member.name]));
}

/**
 * Group names keyed by id, for the group chip on cross-context expense rows. RLS
 * scopes this to groups the caller can read (own, or ones shared with them via 0023);
 * an unreadable group simply degrades to no chip.
 */
async function fetchGroupNamesById(
  groupIds: string[],
): Promise<Map<string, string>> {
  if (groupIds.length === 0) return new Map();
  const supabase = createClient();
  const { data } = await supabase
    .from('groups')
    .select('id, name')
    .in('id', groupIds);
  return new Map((data ?? []).map((group) => [group.id, group.name]));
}

/**
 * Every expense the caller can see — their own PLUS any shared with them as a
 * participant — each joined to its category, payer, and participant count, and marked
 * with `isOwn` / `addedByName`. Sorted by expense date (newest first by default).
 *
 * Scoping is left to RLS rather than an `owner_id` filter: an owner-only filter would
 * hide an expense from the very person who was added to it, and would disagree with
 * the balance engine's context (`getBalanceContext`), which is already RLS-scoped.
 * Both kinds are listed together and distinguished by their marker, so the caller sees
 * one coherent list instead of two half-lists.
 */
export async function listExpenses(
  filter?: ExpenseFilter,
): Promise<ExpenseListItem[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();

  let query = supabase.from('expenses').select('*');
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

// `listSharedWithMe` was removed: shared expenses are no longer a separate list. They
// come back from `listExpenses` alongside the caller's own (RLS scopes both) and are
// distinguished by `isOwn` / `addedByName`. Keeping a second list meant the same
// expense appeared twice on the page once `listExpenses` became RLS-scoped.

/**
 * Full detail for one expense: fields, category, payer, group, and each
 * participant's share. Returns `null` when the expense isn't visible to the
 * caller (not owned and not shared with them).
 */
export async function getExpense(
  expenseId: string,
): Promise<ExpenseDetail | null> {
  const supabase = createClient();

  // The expense row and its splits both key only off `expenseId`, so they're
  // independent — fetch them in one round-trip's worth of latency instead of a
  // waterfall. (An unreadable expense wastes the splits read, but that's the
  // rare miss path, not the hot one.)
  const [{ data: expense }, { data: splits }] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single<Expense>(),
    supabase
      .from('expense_splits')
      .select('member_id, share_cents, split_type')
      .eq('expense_id', expenseId),
  ]);
  if (!expense) return null;

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

  // Member rows and settlement standing are independent (the status RPC keys off
  // `expenseId` alone), so resolve them together rather than in a waterfall.
  const participantIds = (splits ?? []).map((split) => split.member_id);
  const [membersById, statusMap] = await Promise.all([
    fetchMembersById([expense.paid_by, ...participantIds]),
    // Settlement standing from the OWNER's ledger (migration 0031), so a shared
    // participant sees the same figures — payments made by anyone, on any account,
    // clear this expense's remaining identically here. Empty when 0031 isn't
    // applied, in which case the manual settled flag alone drives status.
    fetchSettlementStatus([expenseId]),
  ]);

  const payer = membersById.get(expense.paid_by);
  if (!payer) return null;

  const status = statusMap.get(expenseId);
  const manualSettled = Boolean(expense.settled_at);
  const fullySettled = manualSettled || Boolean(status?.fullySettled);

  // Per-member paid / owed / remaining for this one expense, derived (not stored)
  // from the split set, the payments allocated to it (0031), and the manual flag.
  const figures = new Map(
    expenseMemberLedger({
      amountCents: expense.amount_cents,
      payerId: expense.paid_by,
      splits: (splits ?? []).map((split) => ({
        memberId: split.member_id,
        shareCents: split.share_cents,
      })),
      settled: manualSettled,
      settledByMember: status?.settledByMember,
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
    fullySettled,
  };
}
