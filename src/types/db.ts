/**
 * Convenience re-exports over the generated database types.
 * Feature-specific row/insert/update aliases are added here as tables land
 * in later phases (e.g. `type Profile = Tables<'profiles'>`).
 */
import type { Database } from './database.types';

export type { Database, Json } from './database.types';

export type PublicSchema = Database['public'];
