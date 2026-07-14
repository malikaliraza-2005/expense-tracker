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

/** Phase 1 — Authentication. */
export type Profile = Tables<'profiles'>;
