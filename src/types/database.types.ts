/**
 * Supabase database types.
 *
 * Hand-authored to match the applied migrations. In a later phase this file can
 * be regenerated wholesale from the live schema with:
 *
 *   supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 *
 * Phase 1 (Authentication) adds `profiles` (migration 0001).
 * Phase 2 (Database, RLS & Balance Engine) adds every remaining table and the
 * `group_type` / `split_type` enums (migration 0002).
 *
 * Migration 0010 pivots participants from accounts to name-only `members`: every
 * participant reference (payer, split, settlement party, group membership) now
 * points at `members`, and `friendships` is removed. Everything is owner-scoped.
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
      categories: {
        Row: {
          id: number;
          name: string;
          icon: string;
        };
        Insert: {
          id: number;
          name: string;
          icon: string;
        };
        Update: {
          id?: number;
          name?: string;
          icon?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          is_self: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          is_self?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          is_self?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'members_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          type: Database['public']['Enums']['group_type'];
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          type?: Database['public']['Enums']['group_type'];
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          type?: Database['public']['Enums']['group_type'];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          member_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          member_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          member_id?: string;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          owner_id: string;
          group_id: string | null;
          title: string;
          description: string | null;
          amount_cents: number;
          currency: string;
          category_id: number;
          expense_date: string;
          paid_by: string;
          notes: string | null;
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          group_id?: string | null;
          title: string;
          description?: string | null;
          amount_cents: number;
          currency?: string;
          category_id: number;
          expense_date?: string;
          paid_by: string;
          notes?: string | null;
          settled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          group_id?: string | null;
          title?: string;
          description?: string | null;
          amount_cents?: number;
          currency?: string;
          category_id?: number;
          expense_date?: string;
          paid_by?: string;
          notes?: string | null;
          settled_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_paid_by_fkey';
            columns: ['paid_by'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          member_id: string;
          share_cents: number;
          split_type: Database['public']['Enums']['split_type'];
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          member_id: string;
          share_cents: number;
          split_type?: Database['public']['Enums']['split_type'];
          created_at?: string;
        };
        Update: {
          id?: string;
          expense_id?: string;
          member_id?: string;
          share_cents?: number;
          split_type?: Database['public']['Enums']['split_type'];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_splits_expense_id_fkey';
            columns: ['expense_id'];
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_splits_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          owner_id: string;
          group_id: string | null;
          payer_id: string;
          receiver_id: string;
          amount_cents: number;
          currency: string;
          note: string | null;
          settled_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          group_id?: string | null;
          payer_id: string;
          receiver_id: string;
          amount_cents: number;
          currency?: string;
          note?: string | null;
          settled_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          group_id?: string | null;
          payer_id?: string;
          receiver_id?: string;
          amount_cents?: number;
          currency?: string;
          note?: string | null;
          settled_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'settlements_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlements_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlements_payer_id_fkey';
            columns: ['payer_id'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlements_receiver_id_fkey';
            columns: ['receiver_id'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Migration 0010 — return (creating on first call) the caller's self-member
      // id, so the owner can always be a payer/participant.
      ensure_self_member: {
        Args: Record<string, never>;
        Returns: string;
      };
      // Migration 0010 — atomic member-based expense + splits write. Persists the
      // expense with its pre-validated integer-cent shares in one transaction and
      // returns the affected expense row. `member_id` keys each split.
      create_expense_with_splits: {
        Args: {
          p_group_id: string | null;
          p_title: string;
          p_description: string | null;
          p_amount_cents: number;
          p_currency: string;
          p_category_id: number;
          p_expense_date: string;
          p_paid_by: string;
          p_notes: string | null;
          p_split_type: Database['public']['Enums']['split_type'];
          p_splits: Array<{ member_id: string; share_cents: number }>;
        };
        Returns: Database['public']['Tables']['expenses']['Row'];
      };
      update_expense_with_splits: {
        Args: {
          p_expense_id: string;
          p_group_id: string | null;
          p_title: string;
          p_description: string | null;
          p_amount_cents: number;
          p_currency: string;
          p_category_id: number;
          p_expense_date: string;
          p_paid_by: string;
          p_notes: string | null;
          p_split_type: Database['public']['Enums']['split_type'];
          p_splits: Array<{ member_id: string; share_cents: number }>;
        };
        Returns: Database['public']['Tables']['expenses']['Row'];
      };
    };
    Enums: {
      group_type: 'trip' | 'home' | 'friends' | 'couple' | 'office' | 'other';
      split_type: 'equal' | 'exact' | 'percentage';
    };
    CompositeTypes: Record<string, never>;
  };
}
