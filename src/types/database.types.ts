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
          email: string | null;
          is_self: boolean;
          // Migration 0014 — the real account that claimed this member, or null.
          linked_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          email?: string | null;
          is_self?: boolean;
          linked_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          email?: string | null;
          is_self?: boolean;
          linked_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'members_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'members_linked_user_id_fkey';
            columns: ['linked_user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      // Migration 0014 — email invites asking a recipient to register and claim
      // a member row.
      invitations: {
        Row: {
          id: string;
          inviter_id: string;
          member_id: string;
          email: string;
          token: string;
          target_expense_id: string | null;
          target_group_id: string | null;
          status: string;
          // Migration 0016 — 'member' (email invite) vs 'friend' (in-app request).
          kind: string;
          accepted_user_id: string | null;
          accepted_at: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          inviter_id: string;
          member_id: string;
          email: string;
          token?: string;
          target_expense_id?: string | null;
          target_group_id?: string | null;
          status?: string;
          kind?: string;
          accepted_user_id?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          inviter_id?: string;
          member_id?: string;
          email?: string;
          token?: string;
          target_expense_id?: string | null;
          target_group_id?: string | null;
          status?: string;
          kind?: string;
          accepted_user_id?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_inviter_id_fkey';
            columns: ['inviter_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'members';
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
          is_personal: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          type?: Database['public']['Enums']['group_type'];
          is_personal?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          type?: Database['public']['Enums']['group_type'];
          is_personal?: boolean;
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
      // Migration 0012 — owner-minted, revocable read-only share links per member.
      member_share_tokens: {
        Row: {
          token: string;
          member_id: string;
          owner_id: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          token?: string;
          member_id: string;
          owner_id: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          token?: string;
          member_id?: string;
          owner_id?: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_share_tokens_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_share_tokens_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      // Migration 0017 — a text/emoji message in one expense's isolated chat thread,
      // keyed by expense_id. sender_id is an account (profiles.id).
      messages: {
        Row: {
          id: string;
          expense_id: string;
          sender_id: string;
          body: string;
          created_at: string;
          // Migration 0032 — set when the sender deleted this message for everyone.
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          expense_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          expense_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_expense_id_fkey';
            columns: ['expense_id'];
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      // Migration 0018 — per-user activity feed (owner_id = whose feed). Written only
      // via the log_activity() RPC; display strings are denormalized.
      activity_events: {
        Row: {
          id: string;
          owner_id: string;
          type: string;
          actor_id: string | null;
          actor_name: string | null;
          subject: string | null;
          expense_id: string | null;
          group_id: string | null;
          member_id: string | null;
          // Migration 0020 — settlement link + denormalized context name.
          settlement_id: string | null;
          context_label: string | null;
          amount_cents: number | null;
          currency: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          type: string;
          actor_id?: string | null;
          actor_name?: string | null;
          subject?: string | null;
          expense_id?: string | null;
          group_id?: string | null;
          member_id?: string | null;
          settlement_id?: string | null;
          context_label?: string | null;
          amount_cents?: number | null;
          currency?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          type?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          subject?: string | null;
          expense_id?: string | null;
          group_id?: string | null;
          member_id?: string | null;
          settlement_id?: string | null;
          context_label?: string | null;
          amount_cents?: number | null;
          currency?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_events_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_events_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      // Migration 0029 — one row per PAIR of connected accounts (user_a < user_b),
      // the container for a one-to-one direct-message conversation. Rows are created
      // only via get_or_create_dm_thread.
      dm_threads: {
        Row: {
          id: string;
          user_a: string;
          user_b: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_a: string;
          user_b: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_a?: string;
          user_b?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dm_threads_user_a_fkey';
            columns: ['user_a'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dm_threads_user_b_fkey';
            columns: ['user_b'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      // Migration 0029 — one message in a DM thread. Mirrors public.messages: body is
      // plain text 1-2000 chars, sender is an account (profiles.id), immutable once sent.
      dm_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          body: string;
          created_at: string;
          // Migration 0032 — set when the sender deleted this message for everyone.
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dm_messages_thread_id_fkey';
            columns: ['thread_id'];
            referencedRelation: 'dm_threads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dm_messages_sender_id_fkey';
            columns: ['sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      // Migration 0029 — how far one account has read in one DM thread. Unread =
      // messages from the OTHER party newer than last_read_at.
      dm_reads: {
        Row: {
          thread_id: string;
          user_id: string;
          last_read_at: string;
        };
        Insert: {
          thread_id: string;
          user_id: string;
          last_read_at?: string;
        };
        Update: {
          thread_id?: string;
          user_id?: string;
          last_read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dm_reads_thread_id_fkey';
            columns: ['thread_id'];
            referencedRelation: 'dm_threads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dm_reads_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      // Migration 0032 — a per-user "delete for me" on a per-expense chat message: the
      // message is hidden from that user's view only (never mutated, never shared).
      message_deletions: {
        Row: {
          message_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_deletions_message_id_fkey';
            columns: ['message_id'];
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'message_deletions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      // Migration 0032 — a per-user "delete for me" on a DM message.
      dm_message_deletions: {
        Row: {
          message_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dm_message_deletions_message_id_fkey';
            columns: ['message_id'];
            referencedRelation: 'dm_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dm_message_deletions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
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
      // Migration 0033 — the caller's Personal group id, created (with their
      // self-member) on first call. The default scope for a quick add.
      ensure_personal_group: {
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
      // Migration 0012 — public, read-only balance for a share token: that member's
      // per-currency net versus the owner. No rows for an invalid/revoked token.
      member_ledger_by_token: {
        Args: { p_token: string };
        Returns: {
          member_name: string;
          owner_name: string;
          currency: string | null;
          net_cents: number;
        }[];
      };
      // Migration 0014 — public, display-only fields for one invite token. No rows
      // for an unknown token.
      invite_details: {
        Args: { p_token: string };
        Returns: {
          email: string;
          inviter_name: string;
          member_name: string;
          status: string;
        }[];
      };
      // Migration 0014 — authenticated accept: claims the member row and returns
      // the route to land on, or null when the invite can't be accepted.
      accept_invite: {
        Args: { p_token: string };
        Returns: string | null;
      };
      // Migration 0015 — RLS helpers for cross-user read visibility. Not called
      // from app code (used inside the shared SELECT policies); typed for
      // completeness.
      can_see_expense: {
        Args: { p_expense_id: string };
        Returns: boolean;
      };
      can_see_member: {
        Args: { p_member_id: string };
        Returns: boolean;
      };
      // Migration 0016 — account id for an email (or null). Routes add-by-email
      // to an in-app friend request (hit) vs an email invite (miss).
      find_profile_by_email: {
        Args: { p_email: string };
        Returns: string | null;
      };
      // Migration 0016 — recipient declines a pending/clarifying invite; true when
      // a row changed.
      reject_invite: {
        Args: { p_token: string };
        Returns: boolean;
      };
      // Migration 0017 — per-expense chat gate: true when the caller owns the expense
      // or is a linked participant. Used by messages RLS and callable to decide
      // whether to show the composer.
      can_chat_expense: {
        Args: { p_expense: string };
        Returns: boolean;
      };
      // Migration 0018 — append activity events (JSON array) to feeds; pins the actor
      // to auth.uid() and guards cross-feed writes. Returns the count inserted.
      log_activity: {
        Args: { p_events: Json };
        Returns: number;
      };
      // Migration 0026 — remove a settlement as either the ledger owner or the account
      // a party member represents. True when a row was actually deleted.
      unsettle_member: {
        Args: { p_settlement_id: string };
        Returns: boolean;
      };
      // Migration 0025 — notify an expense thread's other participants of a new chat
      // message (one batched entry per reader). Returns rows touched.
      log_chat_activity: {
        Args: { p_expense_id: string };
        Returns: number;
      };
      // Migration 0021 — record ONE settlement against the balance with a member,
      // callable by either the ledger owner or the account that member represents.
      // Returns the settlement id, or null when the caller isn't a party.
      settle_member: {
        Args: {
          p_member_id: string;
          p_amount_cents: number;
          p_member_pays: boolean;
          p_group_id?: string | null;
        };
        Returns: string | null;
      };
      // Migration 0031 — aggregate settlement standing (owed/settled/remaining +
      // per-debtor settled map) for each VISIBLE expense in `p_expense_ids`, computed
      // from the OWNER's complete ledger. Lets a shared participant derive the SAME
      // status the owner sees without exposing individual settlement rows. Rows the
      // caller can't see are silently dropped. `settled_by_member` maps a debtor's
      // member id to how much of THEIR share is settled.
      expense_settlement_status: {
        Args: { p_expense_ids: string[] };
        Returns: {
          expense_id: string;
          owed_cents: number;
          settled_cents: number;
          remaining_cents: number;
          fully_settled: boolean;
          settled_by_member: Record<string, number>;
        }[];
      };
      // Migration 0029 — true when the CALLER and p_other are linked by a members row
      // either direction. Single-argument: the caller comes from auth.uid().
      is_connected_to: {
        Args: { p_other: string };
        Returns: boolean;
      };
      // Migration 0029 — true when the caller is one of the two accounts on this DM
      // thread. The gate behind every dm_messages/dm_reads policy.
      can_access_dm_thread: {
        Args: { p_thread: string };
        Returns: boolean;
      };
      // Migration 0029 — the id of the caller's DM thread with p_other, creating it on
      // first use. Null when not signed in, self, or the two aren't connected.
      get_or_create_dm_thread: {
        Args: { p_other: string };
        Returns: string | null;
      };
      // Migration 0029 — the caller's DM threads, newest-activity first, each with its
      // last message and unread count. RLS-scoped (SECURITY INVOKER).
      list_dm_threads: {
        Args: Record<string, never>;
        Returns: {
          thread_id: string;
          other_user_id: string;
          last_body: string | null;
          last_at: string | null;
          last_sender_id: string | null;
          unread_count: number;
        }[];
      };
      // Migration 0030 — true when the caller may take part in the typing channel
      // p_topic names (dm-typing:<id> / expense-typing:<id>). Fails closed.
      can_receive_typing: {
        Args: { p_topic: string };
        Returns: boolean;
      };
      // Migration 0032 — retract a per-expense chat message for everyone (sender only);
      // soft-deletes + tombstones the body. True when a live own message was retracted.
      delete_expense_message_for_everyone: {
        Args: { p_message: string };
        Returns: boolean;
      };
      // Migration 0032 — retract a DM message for both participants (sender only).
      delete_dm_message_for_everyone: {
        Args: { p_message: string };
        Returns: boolean;
      };
    };
    Enums: {
      group_type: 'trip' | 'home' | 'friends' | 'couple' | 'office' | 'other';
      split_type: 'equal' | 'exact' | 'percentage';
    };
    CompositeTypes: Record<string, never>;
  };
}
