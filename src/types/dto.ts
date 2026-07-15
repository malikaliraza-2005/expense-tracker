/**
 * Data Transfer Objects.
 *
 * Read-shaped types returned by the data-access layer (lib/queries/*) and
 * consumed by Server Components. They compose the raw database row types
 * (types/db.ts) with the derived balance figures from the balance engine
 * (lib/balances.ts) so the UI never assembles these shapes itself.
 *
 * Since migration 0010 every participant is a name-only `Member` owned by the
 * account owner — there are no participant `Profile`s. Balance `netCents` is
 * always from the owner's self-member perspective: > 0 the member owes the
 * owner, < 0 the owner owes the member.
 */
import type {
  Category,
  Expense,
  Group,
  GroupType,
  Member,
  Settlement,
  SplitType,
} from '@/types/db';

/** A member plus the owner's net balance with them. */
export interface MemberWithBalance {
  member: Member;
  netCents: number;
}

/** Detailed one-member view: the member and the owner's net balance with them. */
export interface MemberBalanceDetail {
  member: Member;
  netCents: number;
}

/** A group plus lightweight figures for the list card. */
export interface GroupWithBalance {
  group: Group;
  memberCount: number;
  /** The owner's net within this group (0 until expenses exist). */
  netCents: number;
}

/** A group-membership row resolved to the member it points at. */
export interface GroupMemberDto {
  member: Member;
  /** True when this is the owner's own (self) member. */
  isSelf: boolean;
}

/** Aggregate figures shown in the group summary header. */
export interface GroupSummary {
  memberCount: number;
  owedToMeCents: number;
  iOweCents: number;
  netCents: number;
}

/** Full group detail: the group, its members, and a balance summary. */
export interface GroupDetail {
  group: Group;
  members: GroupMemberDto[];
  summary: GroupSummary;
}

/** One directed debt in a ledger: `from` owes `to` `amountCents`. */
export interface LedgerEntry {
  from: Member;
  to: Member;
  amountCents: number;
}

/** The who-owes-whom ledger for a group (every pair among its members). */
export interface GroupLedger {
  entries: LedgerEntry[];
}

/** A row in the expense list: the expense joined to its category and payer. */
export interface ExpenseListItem {
  expense: Expense;
  category: Category;
  payer: Member;
  /** Number of participants (expense_splits rows) on the expense. */
  participantCount: number;
}

/** One participant's share within an expense detail view. */
export interface ExpenseParticipant {
  member: Member;
  shareCents: number;
}

/** Full detail for one expense: fields, category, payer, group, and splits. */
export interface ExpenseDetail {
  expense: Expense;
  category: Category;
  payer: Member;
  /** The owning group, or null for a general (ungrouped) expense. */
  group: Group | null;
  participants: ExpenseParticipant[];
  /** The split type recorded on the splits (uniform across an expense). */
  splitType: SplitType;
}

/** A settlement joined to its payer and receiver members, for list/detail. */
export interface SettlementListItem {
  settlement: Settlement;
  payer: Member;
  receiver: Member;
}

/**
 * Everything the dashboard renders: the overall balance summary, recent
 * activity, and per-group figures. All figures are settlement-aware — the engine
 * nets `expense_splits` against `settlements`.
 */
export interface DashboardData {
  /** Total value of outstanding (not-yet-settled) expenses. */
  outstandingCents: number;
  /** Total value of settled expenses. */
  settledCents: number;
  /** Count of outstanding expenses. */
  outstandingCount: number;
  /** Count of settled expenses. */
  settledCount: number;
  /** Most recent outstanding expenses (the dashboard only surfaces these). */
  recentOutstanding: ExpenseListItem[];
  /** Spend grouped by category (all expenses), largest first, for the donut. */
  categoryBreakdown: CategorySpend[];
  /** Total value of all expenses the user participates in (context figure). */
  totalSpendCents: number;
  /** Total value of expenses dated in the current calendar month. */
  monthlySpendCents: number;
  /** Count of expenses the user is involved in. */
  expenseCount: number;
}

/** One slice of the category-spend breakdown shown on the dashboard donut. */
export interface CategorySpend {
  name: string;
  /** categories.icon slug (see constants/categories.ts). */
  icon: string;
  totalCents: number;
}

export type { GroupType };
