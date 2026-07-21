-- ─────────────────────────────────────────────────────────────
-- Migration 0027 — a ledger's rows may only reference that same ledger
--
-- The hole this closes (reproduced against the database, not theorised):
--   Account B — a participant in A's group — could INSERT an expense with
--   `owner_id = B`, `group_id = A's group`, and `paid_by = A's member`. The write was
--   ACCEPTED. Unlike the silent-no-op class (0026), this is not RLS quietly refusing:
--   the database genuinely had no rule against it.
--
--   Why it was reachable: 0015/0023 opened cross-account READS, which widened what a
--   write could REFERENCE. `expenses`' insert policy only ever checked
--   `owner_id = auth.uid()` — true for B — and nothing checked that the group or the
--   payer were B's. The resulting row is nonsense: an expense in A's group, split
--   against A's people, that A cannot see (their queries filter `owner_id = A`) and
--   that pollutes B's balances with people B doesn't own.
--
-- The invariant, stated once and enforced everywhere:
--
--     Every member/group a row points at must belong to that row's OWN `owner_id`.
--
-- Note it is defined against the ROW's owner, NOT `auth.uid()`. That is deliberate and
-- load-bearing: `settle_member`/`unsettle_member` (0021/0026) legitimately let B write a
-- settlement into A's ledger, where `owner_id = A` while `auth.uid() = B`. Phrased this
-- way, those RPCs still pass — the row is internally consistent — while B's cross-ledger
-- expense is rejected. An `auth.uid()`-based rule would have broken symmetric settling.
--
-- Triggers rather than RLS `with check`, for two reasons:
--   1. RLS only constrains `authenticated`. This is a data-integrity invariant that
--      should hold for ANY writer — a script, a service-role job, a future code path —
--      exactly like the FK in 0022. A trigger binds them all.
--   2. RECURSION. A policy subquery on `members`/`groups` runs under THEIR policies, and
--      0015's `members` policy reads `expenses` back — so an `expenses` policy reading
--      `members` would recurse. 0010 and 0023 both warn about this; 0023 solved it the
--      same way, with SECURITY DEFINER. These functions bypass RLS, so their lookups see
--      the truth and can't be tricked (or falsely rejected) by the caller's visibility.
--
-- The app already guards every one of these paths (`allowedMembers` and the ownership
-- checks in the expense/group actions). This makes the DATABASE enforce the rule the app
-- states, in the spirit of 0022 — so no other path can corrupt a ledger.
--
-- SAFE TO APPLY: every existing row was scanned first (26 members, 8 groups, 10
-- expenses, 30 splits, 22 settlements, 15 group memberships) — zero violations. These
-- fire only on INSERT/UPDATE, so existing data is never re-validated.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. expenses — its group and its payer must be the owner's own
-- ============================================================================
create or replace function public.expenses_ledger_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is not null and not exists (
    select 1 from public.groups g
    where g.id = new.group_id and g.owner_id = new.owner_id
  ) then
    raise exception 'expense references a group from another ledger (group %, owner %)',
      new.group_id, new.owner_id
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.members m
    where m.id = new.paid_by and m.owner_id = new.owner_id
  ) then
    raise exception 'expense payer is a member of another ledger (member %, owner %)',
      new.paid_by, new.owner_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_ledger_guard on public.expenses;
create trigger expenses_ledger_guard
  before insert or update of owner_id, group_id, paid_by on public.expenses
  for each row execute function public.expenses_ledger_guard();

-- ============================================================================
-- 2. expense_splits — a share belongs to a member of the EXPENSE's ledger
--
-- The owner is reached through the expense (splits carry no owner_id of their own).
-- ============================================================================
create or replace function public.expense_splits_ledger_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.expenses where id = new.expense_id;
  if v_owner is null then
    return new; -- no expense: the FK will reject this on its own
  end if;

  if not exists (
    select 1 from public.members m
    where m.id = new.member_id and m.owner_id = v_owner
  ) then
    raise exception 'split references a member from another ledger (member %, expense owner %)',
      new.member_id, v_owner
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists expense_splits_ledger_guard on public.expense_splits;
create trigger expense_splits_ledger_guard
  before insert or update of expense_id, member_id on public.expense_splits
  for each row execute function public.expense_splits_ledger_guard();

-- ============================================================================
-- 3. settlements — both parties, and any group, belong to the ledger that owns it
--
-- Checked against `owner_id`, so `settle_member` (B writing into A's ledger) still
-- passes: it builds the row from A's own members.
-- ============================================================================
create or replace function public.settlements_ledger_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.members m
    where m.id = new.payer_id and m.owner_id = new.owner_id
  ) then
    raise exception 'settlement payer is a member of another ledger (member %, owner %)',
      new.payer_id, new.owner_id
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.members m
    where m.id = new.receiver_id and m.owner_id = new.owner_id
  ) then
    raise exception 'settlement receiver is a member of another ledger (member %, owner %)',
      new.receiver_id, new.owner_id
      using errcode = 'check_violation';
  end if;

  if new.group_id is not null and not exists (
    select 1 from public.groups g
    where g.id = new.group_id and g.owner_id = new.owner_id
  ) then
    raise exception 'settlement references a group from another ledger (group %, owner %)',
      new.group_id, new.owner_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists settlements_ledger_guard on public.settlements;
create trigger settlements_ledger_guard
  before insert or update of owner_id, payer_id, receiver_id, group_id on public.settlements
  for each row execute function public.settlements_ledger_guard();

-- ============================================================================
-- 4. group_members — you can only put your OWN people in your OWN group
--
-- Latent twin of the expense hole at the SCHEMA level: this table's policy constrains
-- only the group, never the member — so the database would accept a member from another
-- ledger (one made visible by 0015) being added to your group. `addGroupMember` does
-- owner-verify both sides, so no app path reaches this; the trigger is the backstop for
-- everything that isn't that action.
-- ============================================================================
create or replace function public.group_members_ledger_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_owner  uuid;
  v_member_owner uuid;
begin
  select owner_id into v_group_owner  from public.groups  where id = new.group_id;
  select owner_id into v_member_owner from public.members where id = new.member_id;
  if v_group_owner is null or v_member_owner is null then
    return new; -- the FKs will reject this on their own
  end if;

  if v_group_owner <> v_member_owner then
    raise exception 'cannot add a member of another ledger to this group (member owner %, group owner %)',
      v_member_owner, v_group_owner
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists group_members_ledger_guard on public.group_members;
create trigger group_members_ledger_guard
  before insert or update of group_id, member_id on public.group_members
  for each row execute function public.group_members_ledger_guard();

comment on function public.expenses_ledger_guard is
  'Enforces that an expense''s group and payer belong to its own owner_id. Checked '
  'against the ROW''s owner (not auth.uid()) so definer RPCs writing into another '
  'ledger still pass. See migration 0027.';
