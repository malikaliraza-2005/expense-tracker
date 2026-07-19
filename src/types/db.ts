/**
 * Convenience re-exports and helpers over the generated database types.
 * Feature-specific row/insert/update aliases are added here as tables land in
 * each phase.
 */
import type { Database } from './database.types';

export type { Database, Json } from './database.types';

export type PublicSchema = Database['public'];

/** Row / Insert / Update helpers, mirroring the Supabase-generated shape. */
export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];

/** Database enum helper. */
export type Enums<T extends keyof PublicSchema['Enums']> =
  PublicSchema['Enums'][T];

/** Phase 1 — Authentication. */
export type Profile = Tables<'profiles'>;

/** Phase 2 — full schema. Row-shaped entity aliases. */
export type Category = Tables<'categories'>;
/** Migration 0010 — a name-only person managed by the owner. */
export type Member = Tables<'members'>;
export type Group = Tables<'groups'>;
export type GroupMember = Tables<'group_members'>;
export type Expense = Tables<'expenses'>;
export type ExpenseSplit = Tables<'expense_splits'>;
export type Settlement = Tables<'settlements'>;
/** Migration 0014 — an email invite to register and claim a member row. */
export type Invitation = Tables<'invitations'>;
/** Migration 0017 — a text/emoji message in one expense's isolated chat thread. */
export type Message = Tables<'messages'>;
/** Migration 0029 — a one-to-one DM conversation between two connected accounts. */
export type DmThread = Tables<'dm_threads'>;
/** Migration 0029 — a text/emoji message in a DM thread (keyed by thread_id). */
export type DmMessage = Tables<'dm_messages'>;
/** Migration 0029 — one account's read watermark in one DM thread. */
export type DmRead = Tables<'dm_reads'>;
/** Migration 0018 — one event in a user's activity feed. */
export type ActivityEvent = Tables<'activity_events'>;
/** The discrete activity event kinds recorded in the feed (stored as text). */
export type ActivityType =
  | 'expense_created'
  | 'expense_added_you'
  | 'expense_updated'
  | 'expense_deleted'
  | 'group_created'
  | 'group_added_you'
  | 'group_removed_you'
  | 'group_left'
  | 'settlement_recorded'
  | 'settlement_received'
  | 'friend_added'
  | 'friend_removed'
  | 'balance_changed'
  /** Someone posted in an expense's chat thread (migration 0025). */
  | 'chat_message';
/** Migration 0016 — an invite is either a member email-invite or a friend request. */
export type InvitationKind = 'member' | 'friend';
/**
 * Lifecycle of an invitation. `pending` is live; `accepted`/`rejected` are terminal
 * decisions; `revoked`/`expired` are dead; `clarifying` is reserved (the Phase 5
 * note-thread was deferred to chat, so it is currently unused). Stored as text.
 */
export type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'revoked'
  | 'expired'
  | 'rejected'
  | 'clarifying';

/** Phase 2 — enum aliases. */
export type GroupType = Enums<'group_type'>;
export type SplitType = Enums<'split_type'>;
