/**
 * Data Transfer Objects (Phase 3).
 *
 * Read-shaped types returned by the data-access layer (lib/queries/*) and
 * consumed by Server Components. They compose the raw database row types
 * (types/db.ts) with the derived balance figures from the balance engine
 * (lib/balances.ts) so the UI never assembles these shapes itself.
 *
 * Sign convention for every `netCents` here matches lib/balances.ts, always from
 * the current user's perspective: > 0 the counterparty owes me, < 0 I owe them.
 */
import type { BalanceSummary } from '@/lib/balances';
import type {
  Category,
  Expense,
  Group,
  GroupType,
  Profile,
  Settlement,
  SplitType,
} from '@/types/db';

/** A friend plus the current user's net balance with them. */
export interface FriendWithBalance {
  /** Id of the `friendships` row linking the two users (for removal). */
  friendshipId: string;
  profile: Profile;
  netCents: number;
}

/** Detailed one-friend view: their profile and the net balance between us. */
export interface FriendBalanceDetail {
  friend: Profile;
  netCents: number;
}

/** A group plus lightweight, current-user-scoped figures for the list card. */
export interface GroupWithBalance {
  group: Group;
  memberCount: number;
  /** The current user's net within this group (0 until expenses exist). */
  netCents: number;
}

/** A membership row joined to the member's profile. */
export interface GroupMemberProfile {
  userId: string;
  role: string;
  profile: Profile;
}

/** Aggregate figures shown in the group summary header. */
export interface GroupSummary {
  memberCount: number;
  owedToMeCents: number;
  iOweCents: number;
  netCents: number;
}

/** Full group detail: the group, its members, a summary, and my relationship. */
export interface GroupDetail {
  group: Group;
  members: GroupMemberProfile[];
  summary: GroupSummary;
  /** True when the current user created (owns) the group. */
  isOwner: boolean;
}

/** One directed debt in a group ledger: `from` owes `to` `amountCents`. */
export interface LedgerEntry {
  from: Profile;
  to: Profile;
  amountCents: number;
}

/** The who-owes-whom ledger for a group (current-user-scoped in the MVP). */
export interface GroupLedger {
  entries: LedgerEntry[];
}

/**
 * Phase 4 — Expenses & Splitting.
 */

/** A row in the expense list: the expense joined to its category and payer. */
export interface ExpenseListItem {
  expense: Expense;
  category: Category;
  payer: Profile;
  /** Number of participants (expense_splits rows) on the expense. */
  participantCount: number;
}

/** One participant's share within an expense detail view. */
export interface ExpenseParticipant {
  profile: Profile;
  shareCents: number;
}

/** Full detail for one expense: fields, category, payer, group, and splits. */
export interface ExpenseDetail {
  expense: Expense;
  category: Category;
  payer: Profile;
  /** The owning group, or null for a personal / 1:1 expense. */
  group: Group | null;
  participants: ExpenseParticipant[];
  /** The split type recorded on the splits (uniform across an expense). */
  splitType: SplitType;
  /** True when the current user created the expense (may edit/delete it). */
  isOwner: boolean;
}

/**
 * Phase 5 — Dashboard & Settlements.
 */

/** A settlement joined to its payer and receiver profiles, for list/detail. */
export interface SettlementListItem {
  settlement: Settlement;
  payer: Profile;
  receiver: Profile;
}

/**
 * Everything the dashboard renders: the overall balance summary (reused from the
 * balance engine), plus recent activity and per-group figures. All figures are
 * settlement-aware — the engine nets `expense_splits` against `settlements`.
 */
export interface DashboardData {
  /** Overall you-owe / you-are-owed / net across every relationship. */
  summary: BalanceSummary;
  recentExpenses: ExpenseListItem[];
  recentSettlements: SettlementListItem[];
  /** Per-group summary cards (group + member count + the user's net). */
  groups: GroupWithBalance[];
}

export type { GroupType };
