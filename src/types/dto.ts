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
import type { FriendStatus } from '@/lib/friends';
import type {
  ActivityType,
  Category,
  Expense,
  Group,
  GroupType,
  InvitationKind,
  InvitationStatus,
  Member,
  Settlement,
  SplitType,
} from '@/types/db';

/** A member plus the owner's net balance with them. */
export interface MemberWithBalance {
  member: Member;
  netCents: number;
}

/**
 * A row on the Friends page (Phase 4): one of the owner's members who is linked to
 * a real account or at least reachable by email, the owner's net balance with them,
 * and where they sit on the account-linking journey.
 */
export interface FriendListItem {
  member: Member;
  /** The owner's net balance with this friend: > 0 they owe you, < 0 you owe them. */
  netCents: number;
  /** 'linked' (accepted), 'invited' (pending), or 'not_invited' (emailable). */
  status: FriendStatus;
}

/** Which side of an invitation the current user is on. */
export type RequestDirection = 'sent' | 'received';

/**
 * A row on the Requests page (Phase 5): one invitation flattened to what the UI
 * shows, from the current user's point of view. All request state lives in the
 * `invitations` table; this is the read-shaped projection of it.
 */
export interface RequestItem {
  id: string;
  /** The invite token, used by accept/reject actions. */
  token: string;
  /** 'sent' when the current user is the inviter; 'received' otherwise. */
  direction: RequestDirection;
  /** 'friend' (in-app request) vs 'member' (email invite to register). */
  kind: InvitationKind;
  /** Effective status — a past-expiry 'pending' is surfaced as 'expired'. */
  status: InvitationStatus;
  /** Recipient email (own email on a received row). */
  email: string;
  /** The other party's name: sent → the invited member; received → the inviter. */
  counterpartyName: string;
  /** ISO timestamp the invite was created, for ordering. */
  createdAt: string;
}

/** Detailed one-member view: the member and the owner's net balance with them. */
export interface MemberBalanceDetail {
  member: Member;
  netCents: number;
}

/**
 * One row in the current user's Activity feed (Phase 1). A camel-cased projection of
 * an `activity_events` row — display strings (`actorName`, `subject`) are denormalized
 * at write time, so rendering needs no cross-account joins. Whether the current user
 * was the actor is derived at render (`actorId === meId`).
 */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  /** The account that performed the action (null if that account was deleted). */
  actorId: string | null;
  /** Denormalized actor display name. */
  actorName: string | null;
  /** Denormalized subject label (expense title, group name, or person name). */
  subject: string | null;
  expenseId: string | null;
  groupId: string | null;
  memberId: string | null;
  /** The settlement this event is about, when applicable. */
  settlementId: string | null;
  /** Denormalized name of the group/expense it happened in (e.g. "Trip to Naran"). */
  contextLabel: string | null;
  amountCents: number | null;
  currency: string | null;
  /** ISO timestamp, newest-first ordering. */
  createdAt: string;
  /** When the current user marked it read, or null. */
  readAt: string | null;
}

/**
 * One chat message in an expense's isolated thread, flattened for the UI. Camel-cased
 * projection of a `messages` row (keyed by `expenseId`). `pending` is a client-only
 * flag for an optimistic message not yet confirmed by the server; persisted messages
 * never carry it.
 */
export interface ChatMessage {
  id: string;
  /** The expense this message belongs to — the isolation key. */
  expenseId: string;
  /** The sending account (`profiles.id`). */
  senderId: string;
  body: string;
  /** ISO timestamp, used for ordering. */
  createdAt: string;
  /** True only for an unconfirmed optimistic message on the sender's client. */
  pending?: boolean;
}

/**
 * Everything the per-expense chat panel needs: the current account, whether they may
 * post (the participant gate), the messages so far (oldest-first), and display names
 * for other senders. Returned by the chat query for one expense.
 */
export interface ExpenseChatData {
  expenseId: string;
  /** The current account id — used to align own vs. others' messages. */
  meId: string;
  /** True when the current account may read/post (owner or linked participant). */
  canChat: boolean;
  messages: ChatMessage[];
  /** Display name per sender account id (excludes the current user, shown as "You"). */
  senderNames: Record<string, string>;
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

/** A group member with their in-group paid / share / net figures. */
export interface GroupMemberStatDto {
  member: Member;
  isSelf: boolean;
  /** Total value of expenses this member fronted, within the group. */
  paidCents: number;
  /** This member's total share of the group's expenses. */
  owesCents: number;
  /** The member's own settlement-aware net standing. > 0 owed; < 0 owes. */
  netCents: number;
  /**
   * The owner-centric net with this member within the group: > 0 they owe the
   * owner, < 0 the owner owes them, 0 when square. This is the settle-able
   * figure (the owner records payments), and it drives the card's Settle Up.
   */
  ownerNetCents: number;
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

/**
 * One participant's per-expense ledger within an expense detail view: what they
 * fronted, their share, and what's still outstanding on this expense. `shareCents`
 * is kept as the canonical share (identical to `owedCents`).
 */
export interface ExpenseParticipant {
  member: Member;
  shareCents: number;
  /** Amount this member fronted for the expense — the full total if the payer. */
  paidCents: number;
  /** This member's equal share of the expense (same value as `shareCents`). */
  owedCents: number;
  /** Still-outstanding on this expense; 0 once the expense is settled. */
  remainingCents: number;
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
