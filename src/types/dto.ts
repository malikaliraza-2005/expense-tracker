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
import type { Group, GroupType, Profile } from '@/types/db';

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

export type { GroupType };
