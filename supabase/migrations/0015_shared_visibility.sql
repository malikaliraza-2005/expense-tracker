-- ─────────────────────────────────────────────────────────────
-- Migration 0015 — cross-user visibility (Phase 2)
--
-- Phase 1 lets an invited account CLAIM a member row (members.linked_user_id).
-- This migration lets that claimed participant READ the expenses they're part of
-- — full detail + status, read-only. Owner-only writes are untouched.
--
-- Mechanism: additive FOR SELECT policies, permissive (OR-ed) alongside the
-- existing owner `*_all_own` policies from 0010. They delegate to two SECURITY
-- DEFINER helpers that read the base tables directly — because DEFINER bypasses
-- RLS, the helpers never re-enter these policies, so there is no recursion (the
-- same reason 0010's inline membership helpers existed; cf. member_ledger_by_token
-- in 0012). No new INSERT/UPDATE/DELETE policies are added, so a participant can
-- read a shared expense but never modify it.
--
-- Scope is deliberately narrow: a participant can see the expense, its splits, and
-- the member rows of its co-participants (for name display) — never the owner's
-- whole roster, and not their groups, settlements, or profile.
-- ─────────────────────────────────────────────────────────────

-- Speeds the linked-user lookups the helpers below do (payer/split membership).
-- The 0014 unique index is keyed (owner_id, linked_user_id); this one keys the
-- bare linked_user_id used by `linked_user_id = auth.uid()`.
create index if not exists idx_members_linked_user_id
  on public.members (linked_user_id)
  where linked_user_id is not null;

-- ============================================================================
-- 1. can_see_expense — may auth.uid() read this expense?
--
-- True when the caller owns it, OR is the real account linked to the payer member,
-- OR to any split member. SECURITY DEFINER: the reads below run as the function
-- owner and bypass RLS, so this never recurses into the expenses/splits/members
-- policies that call it.
-- ============================================================================
create or replace function public.can_see_expense(p_expense_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = p_expense_id
      and (
        e.owner_id = auth.uid()
        or exists (
          select 1 from public.members m
          where m.id = e.paid_by and m.linked_user_id = auth.uid()
        )
        or exists (
          select 1
          from public.expense_splits s
          join public.members m on m.id = s.member_id
          where s.expense_id = e.id and m.linked_user_id = auth.uid()
        )
      )
  );
$$;

comment on function public.can_see_expense is
  'True when auth.uid() owns the expense or is the linked account of its payer or any split member. SECURITY DEFINER to avoid RLS recursion; used by the shared SELECT policies.';

grant execute on function public.can_see_expense(uuid) to authenticated;

-- ============================================================================
-- 2. can_see_member — may auth.uid() read this member row (name display)?
--
-- True when the caller owns the member (their own roster), OR the member is the
-- payer/participant of some expense the caller can see — i.e. a co-participant on
-- a shared expense. This confines a participant's view of the owner's people to
-- exactly those sharing an expense with them; the owner's other members stay
-- hidden. Defined after can_see_expense (which it calls).
-- ============================================================================
create or replace function public.can_see_member(p_member_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from public.members m
      where m.id = p_member_id and m.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.expenses e
      where public.can_see_expense(e.id)
        and (
          e.paid_by = p_member_id
          or exists (
            select 1 from public.expense_splits s
            where s.expense_id = e.id and s.member_id = p_member_id
          )
        )
    );
$$;

comment on function public.can_see_member is
  'True when auth.uid() owns the member, or the member co-participates on an expense the caller can see. SECURITY DEFINER to avoid RLS recursion; scopes shared member visibility to co-participants only.';

grant execute on function public.can_see_member(uuid) to authenticated;

-- ============================================================================
-- 3. Additive FOR SELECT policies — read-only shared access
--
-- Permissive: OR-ed with the existing owner `*_all_own` policies (which still
-- govern all writes). A participant matches only these SELECT policies, so they
-- can read a shared expense but cannot insert/update/delete it.
-- ============================================================================
drop policy if exists "expenses_select_shared" on public.expenses;
create policy "expenses_select_shared"
  on public.expenses for select to authenticated
  using (public.can_see_expense(id));

drop policy if exists "expense_splits_select_shared" on public.expense_splits;
create policy "expense_splits_select_shared"
  on public.expense_splits for select to authenticated
  using (public.can_see_expense(expense_id));

drop policy if exists "members_select_shared" on public.members;
create policy "members_select_shared"
  on public.members for select to authenticated
  using (public.can_see_member(id));

-- groups, settlements, and profiles stay owner-only by design: a shared expense
-- exposes its amount/category/date/payer/splits/status and co-participant names,
-- but not the owner's group name, settlement history, or account identity.
