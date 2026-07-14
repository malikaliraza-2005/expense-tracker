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
      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_id?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_friend_id_fkey';
            columns: ['friend_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          type: Database['public']['Enums']['group_type'];
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: Database['public']['Enums']['group_type'];
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: Database['public']['Enums']['group_type'];
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          role?: string;
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
            foreignKeyName: 'group_members_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          group_id: string | null;
          title: string;
          description: string | null;
          amount_cents: number;
          currency: string;
          category_id: number;
          expense_date: string;
          paid_by: string;
          created_by: string;
          receipt_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id?: string | null;
          title: string;
          description?: string | null;
          amount_cents: number;
          currency?: string;
          category_id: number;
          expense_date?: string;
          paid_by: string;
          created_by: string;
          receipt_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string | null;
          title?: string;
          description?: string | null;
          amount_cents?: number;
          currency?: string;
          category_id?: number;
          expense_date?: string;
          paid_by?: string;
          created_by?: string;
          receipt_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
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
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          user_id: string;
          share_cents: number;
          split_type: Database['public']['Enums']['split_type'];
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          user_id: string;
          share_cents: number;
          split_type: Database['public']['Enums']['split_type'];
          created_at?: string;
        };
        Update: {
          id?: string;
          expense_id?: string;
          user_id?: string;
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
            foreignKeyName: 'expense_splits_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
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
            foreignKeyName: 'settlements_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlements_payer_id_fkey';
            columns: ['payer_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlements_receiver_id_fkey';
            columns: ['receiver_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      group_type: 'trip' | 'home' | 'friends' | 'couple' | 'office' | 'other';
      split_type: 'equal' | 'exact' | 'percentage';
    };
    CompositeTypes: Record<string, never>;
  };
}
