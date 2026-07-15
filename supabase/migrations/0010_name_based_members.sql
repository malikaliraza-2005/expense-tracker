-- ─────────────────────────────────────────────────────────────
-- Migration 0010 — name-based members (owner-managed, no accounts)
--
-- Product pivot: only the App Owner has an account. Everyone they split with is
-- a lightweight NAME stored under the owner's account — no registration, login,
-- email, invitation, or profile for participants. The owner manages everyone.
--
-- This replaces the previous account-centric participant model (friendships +
-- profile-referencing expenses/splits/settlements/group_members) with a single
-- `members` table that every participant reference now points at. Because there
-- is no faithful mapping from cross-account friendships to single-owner names,
-- this migration REBUILDS the transactional tables around `members`. `profiles`
-- (the owner's account), `auth`, and the seeded `categories` are preserved.
--
-- Authorization collapses to one rule: a row is visible/writable only to the
-- account owner (`owner_id = auth.uid()`), so the recursive membership helpers of
-- migration 0002 are no longer needed. Child tables (group_members,
-- expense_splits) are scoped through their owning parent.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 0. Tear down the old account-centric participant model
-- ============================================================================
-- Order matters: drop dependents before their referenced tables.
drop table if exists public.expense_splits cascade;
drop table if exists public.settlements    cascade;
drop table if exists public.expenses       cascade;
drop table if exists public.group_members  cascade;
drop table if exists public.groups         cascade;
drop table if exists public.friendships    cascade;

-- The old friendships-based read policy on profiles is gone with the table.
drop policy if exists "profiles_select_shared" on public.profiles;

-- Obsolete helpers from migration 0002 (membership recursion) and 0007.
drop function if exists public.is_group_member(uuid)   cascade;
drop function if exists public.is_group_owner(uuid)    cascade;
drop function if exists public.shares_group_with(uuid) cascade;
drop function if exists public.can_read_expense(uuid)  cascade;
drop function if exists public.owns_expense(uuid)      cascade;
drop function if exists public.find_profile_by_email(text) cascade;

-- ============================================================================
-- 1. members — the owner's people, identified only by name
-- ============================================================================
create table public.members (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null references public.profiles (id) on delete cascade,
  name       text        not null check (length(btrim(name)) between 1 and 60),
  -- Exactly one self-member per owner represents the owner as a participant.
  is_self    boolean     not null default false,
  created_at timestamptz not null default now()
);

comment on table public.members is
  'A person the owner splits with, stored as a name only. No account, email, or login. Everything is scoped to owner_id = auth.uid().';

create index idx_members_owner_id on public.members (owner_id);
-- At most one self-member per owner.
create unique index members_one_self_per_owner
  on public.members (owner_id) where is_self;

-- ============================================================================
-- 2. groups — a named container of the owner's members
-- ============================================================================
create table public.groups (
  id         uuid              primary key default gen_random_uuid(),
  owner_id   uuid              not null references public.profiles (id) on delete cascade,
  name       text              not null,
  type       public.group_type not null default 'other',
  created_at timestamptz       not null default now()
);

create index idx_groups_owner_id on public.groups (owner_id);

-- 2.1 group_members — which of the owner's members belong to a group
create table public.group_members (
  id        uuid        primary key default gen_random_uuid(),
  group_id  uuid        not null references public.groups (id)  on delete cascade,
  member_id uuid        not null references public.members (id) on delete cascade,
  joined_at timestamptz not null default now(),
  constraint group_members_unique_membership unique (group_id, member_id)
);

create index idx_group_members_group_id  on public.group_members (group_id);
create index idx_group_members_member_id on public.group_members (member_id);

-- ============================================================================
-- 3. expenses — group_id nullable (a general, ungrouped expense)
-- ============================================================================
create table public.expenses (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null references public.profiles (id) on delete cascade,
  group_id     uuid        references public.groups (id) on delete cascade,
  title        text        not null,
  description  text,
  amount_cents int         not null check (amount_cents >= 0),
  currency     text        not null default 'USD',
  category_id  int         not null references public.categories (id),
  expense_date date        not null default current_date,
  paid_by      uuid        not null references public.members (id) on delete restrict,
  notes        text,
  created_at   timestamptz not null default now()
);

create index idx_expenses_owner_id     on public.expenses (owner_id);
create index idx_expenses_group_id     on public.expenses (group_id);
create index idx_expenses_paid_by      on public.expenses (paid_by);
create index idx_expenses_category_id  on public.expenses (category_id);
create index idx_expenses_expense_date on public.expenses (expense_date);

-- 3.1 expense_splits — one row per participating member; source of "who owes what"
create table public.expense_splits (
  id          uuid              primary key default gen_random_uuid(),
  expense_id  uuid              not null references public.expenses (id) on delete cascade,
  member_id   uuid              not null references public.members (id)  on delete cascade,
  share_cents int               not null check (share_cents >= 0),
  split_type  public.split_type not null default 'equal',
  created_at  timestamptz       not null default now(),
  constraint expense_splits_unique_participant unique (expense_id, member_id)
);

create index idx_expense_splits_expense_id on public.expense_splits (expense_id);
create index idx_expense_splits_member_id  on public.expense_splits (member_id);

-- ============================================================================
-- 4. settlements — a recorded transfer between two of the owner's members
-- ============================================================================
create table public.settlements (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references public.profiles (id) on delete cascade,
  group_id    uuid        references public.groups (id) on delete cascade,
  payer_id    uuid        not null references public.members (id) on delete restrict,
  receiver_id uuid        not null references public.members (id) on delete restrict,
  amount_cents int        not null check (amount_cents > 0),
  currency    text        not null default 'USD',
  note        text,
  settled_at  timestamptz not null default now(),
  constraint settlements_distinct_parties check (payer_id <> receiver_id)
);

create index idx_settlements_owner_id    on public.settlements (owner_id);
create index idx_settlements_group_id    on public.settlements (group_id);
create index idx_settlements_payer_id    on public.settlements (payer_id);
create index idx_settlements_receiver_id on public.settlements (receiver_id);

-- ============================================================================
-- 5. Row Level Security — one rule: you own it (owner_id = auth.uid())
-- ============================================================================

-- 5.1 members
alter table public.members enable row level security;

drop policy if exists "members_all_own" on public.members;
create policy "members_all_own"
  on public.members for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 5.2 groups
alter table public.groups enable row level security;

drop policy if exists "groups_all_own" on public.groups;
create policy "groups_all_own"
  on public.groups for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 5.3 group_members — scoped through the owning group (no recursion: the
-- subquery reads `groups`, whose own policy never references group_members).
alter table public.group_members enable row level security;

drop policy if exists "group_members_all_own" on public.group_members;
create policy "group_members_all_own"
  on public.group_members for all to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.owner_id = auth.uid()
    )
  );

-- 5.4 expenses
alter table public.expenses enable row level security;

drop policy if exists "expenses_all_own" on public.expenses;
create policy "expenses_all_own"
  on public.expenses for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 5.5 expense_splits — scoped through the owning expense.
alter table public.expense_splits enable row level security;

drop policy if exists "expense_splits_all_own" on public.expense_splits;
create policy "expense_splits_all_own"
  on public.expense_splits for all to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and e.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and e.owner_id = auth.uid()
    )
  );

-- 5.6 settlements
alter table public.settlements enable row level security;

drop policy if exists "settlements_all_own" on public.settlements;
create policy "settlements_all_own"
  on public.settlements for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- 6. Self-member: every owner is represented by one member row
-- ============================================================================
-- Ensure a self-member exists for the current user, returning its id. Called by
-- the app on load so the owner can always be a payer/participant. SECURITY
-- DEFINER so the insert runs regardless of RLS timing; still keyed to auth.uid().
create or replace function public.ensure_self_member()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select id into v_id
  from public.members
  where owner_id = auth.uid() and is_self
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  select coalesce(nullif(btrim(full_name), ''), 'You') into v_name
  from public.profiles where id = auth.uid();

  insert into public.members (owner_id, name, is_self)
  values (auth.uid(), coalesce(v_name, 'You'), true)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.ensure_self_member is
  'Returns the caller''s self-member id, creating it (named after their profile) on first call.';

-- Backfill a self-member for every existing profile so current owners are ready.
insert into public.members (owner_id, name, is_self)
select p.id, coalesce(nullif(btrim(p.full_name), ''), 'You'), true
from public.profiles p
where not exists (
  select 1 from public.members m where m.owner_id = p.id and m.is_self
);

-- ============================================================================
-- 7. Atomic expense + splits write functions (member-based)
--
-- SECURITY DEFINER: RLS is bypassed, so authorship and every referenced id are
-- verified explicitly here against auth.uid(). This also sidesteps the 42501
-- RETURNING/RLS interaction documented in migration 0009. Split MATH is still
-- computed in TypeScript (lib/splits.ts) — these only persist the result.
-- ============================================================================

-- Shared guard: every id referenced by an expense write must belong to `owner`.
-- Defined first so the write functions below can call it.
create or replace function public.assert_expense_refs(
  p_owner    uuid,
  p_group_id uuid,
  p_paid_by  uuid,
  p_splits   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_group_id is not null and not exists (
    select 1 from public.groups g where g.id = p_group_id and g.owner_id = p_owner
  ) then
    raise exception 'Group does not belong to the current user.';
  end if;

  if not exists (
    select 1 from public.members m where m.id = p_paid_by and m.owner_id = p_owner
  ) then
    raise exception 'Payer is not one of your members.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_splits) as elem
    where not exists (
      select 1 from public.members m
      where m.id = (elem ->> 'member_id')::uuid and m.owner_id = p_owner
    )
  ) then
    raise exception 'A split participant is not one of your members.';
  end if;
end;
$$;

create or replace function public.create_expense_with_splits(
  p_group_id     uuid,
  p_title        text,
  p_description  text,
  p_amount_cents int,
  p_currency     text,
  p_category_id  int,
  p_expense_date date,
  p_paid_by      uuid,
  p_notes        text,
  p_split_type   public.split_type,
  p_splits       jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid := auth.uid();
  v_expense public.expenses;
  v_id      uuid := gen_random_uuid();
begin
  if v_owner is null then
    raise exception 'Not authenticated.';
  end if;

  perform public.assert_expense_refs(v_owner, p_group_id, p_paid_by, p_splits);

  insert into public.expenses (
    id, owner_id, group_id, title, description, amount_cents, currency,
    category_id, expense_date, paid_by, notes
  )
  values (
    v_id, v_owner, p_group_id, p_title, nullif(p_description, ''),
    p_amount_cents, coalesce(nullif(p_currency, ''), 'USD'),
    p_category_id, coalesce(p_expense_date, current_date), p_paid_by,
    nullif(p_notes, '')
  );

  insert into public.expense_splits (expense_id, member_id, share_cents, split_type)
  select v_id, (elem ->> 'member_id')::uuid, (elem ->> 'share_cents')::int, p_split_type
  from jsonb_array_elements(p_splits) as elem;

  select * into v_expense from public.expenses where id = v_id;
  return v_expense;
end;
$$;

create or replace function public.update_expense_with_splits(
  p_expense_id   uuid,
  p_group_id     uuid,
  p_title        text,
  p_description  text,
  p_amount_cents int,
  p_currency     text,
  p_category_id  int,
  p_expense_date date,
  p_paid_by      uuid,
  p_notes        text,
  p_split_type   public.split_type,
  p_splits       jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid := auth.uid();
  v_expense public.expenses;
begin
  if v_owner is null then
    raise exception 'Not authenticated.';
  end if;

  perform public.assert_expense_refs(v_owner, p_group_id, p_paid_by, p_splits);

  update public.expenses
  set
    group_id     = p_group_id,
    title        = p_title,
    description  = nullif(p_description, ''),
    amount_cents = p_amount_cents,
    currency     = coalesce(nullif(p_currency, ''), 'USD'),
    category_id  = p_category_id,
    expense_date = coalesce(p_expense_date, current_date),
    paid_by      = p_paid_by,
    notes        = nullif(p_notes, '')
  where id = p_expense_id and owner_id = v_owner;

  if not found then
    raise exception 'Expense not found or not editable by the current user.';
  end if;

  delete from public.expense_splits where expense_id = p_expense_id;

  insert into public.expense_splits (expense_id, member_id, share_cents, split_type)
  select p_expense_id, (elem ->> 'member_id')::uuid, (elem ->> 'share_cents')::int, p_split_type
  from jsonb_array_elements(p_splits) as elem;

  select * into v_expense from public.expenses where id = p_expense_id;
  return v_expense;
end;
$$;

comment on function public.create_expense_with_splits is
  'Atomically insert a member-based expense and its splits. SECURITY DEFINER; owner_id and all references are verified against auth.uid().';
comment on function public.update_expense_with_splits is
  'Atomically update a member-based expense and replace its splits. SECURITY DEFINER; ownership of the expense and all references verified against auth.uid().';
