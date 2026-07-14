/**
 * Supabase-generated database types.
 *
 * PLACEHOLDER (Phase 0): the schema is introduced in Phase 2. This file will be
 * regenerated with:
 *
 *   supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 *
 * Until then it exposes an empty-but-valid `Database` shape so the typed Supabase
 * clients compile.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
