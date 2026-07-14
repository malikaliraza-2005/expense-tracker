/**
 * Supabase database types.
 *
 * Hand-authored to match the applied migrations. In a later phase this file can
 * be regenerated wholesale from the live schema with:
 *
 *   supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 *
 * Phase 1 (Authentication) adds the `profiles` table (migration 0001). The
 * remaining tables land in Phase 2.
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
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          preferred_currency: string;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          avatar_url?: string | null;
          preferred_currency?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          preferred_currency?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
