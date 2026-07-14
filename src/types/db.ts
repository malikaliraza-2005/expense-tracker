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
export type Friendship = Tables<'friendships'>;
export type Group = Tables<'groups'>;
export type GroupMember = Tables<'group_members'>;
export type Expense = Tables<'expenses'>;
export type ExpenseSplit = Tables<'expense_splits'>;
export type Settlement = Tables<'settlements'>;

/** Phase 2 — enum aliases. */
export type GroupType = Enums<'group_type'>;
export type SplitType = Enums<'split_type'>;
