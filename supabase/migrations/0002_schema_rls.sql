-- ─────────────────────────────────────────────────────────────
-- Migration 0002 — full schema, RLS & category seed
--
-- Phase 2 (Database, RLS & Balance Engine). Introduces every remaining table,
-- the two enums, all foreign-key indexes, membership-scoped Row Level Security
-- for each table, and the static `categories` seed.
--
-- Balances are NOT stored — they are derived on read in lib/balances.ts from
-- `expense_splits` + `settlements`. No balance columns or triggers exist here.
--
-- RLS is the primary authorization boundary. Deny-by-default: RLS is enabled on
-- every table and the minimum access is granted back via explicit policies.
-- Membership checks go through SECURITY DEFINER helper functions (§2 below) so
-- that a policy on `group_members`/`expenses` never recurses into the same
-- table it protects.
--
-- See docs/database-design.md §2–§7 and
-- docs/phases/phase-2-database-rls-balance-engine.md.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. Enums
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'group_type') then
    create type public.group_type as enum
      ('trip', 'home', 'friends', 'couple', 'office', 'other');
  end if;

  if not exists (select 1 from pg_type where typname = 'split_type') then
    create type public.split_type as enum ('equal', 'exact', 'percentage');
  end if;
end$$;

-- ============================================================================
-- 2. Tables
-- ============================================================================

-- 2.1 categories — static, seeded lookup (see §6 for the seed) ---------------
create table if not exists public.categories (
  id   int  primary key,
  name text not null,
  icon text not null
);

comment on table public.categories is
  'Static, seeded expense categories. Readable by all authenticated users; not user-writable.';

-- 2.2 friendships — directional friend links between registered users --------
create table if not exists public.friendships (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  friend_id  uuid        not null references public.profiles (id) on delete cascade,
  status     text        not null default 'accepted',
  created_at timestamptz not null default now(),
  constraint friendships_unique_pair unique (user_id, friend_id),
  constraint friendships_no_self     check (user_id <> friend_id)
);

comment on table public.friendships is
  'Directional friend links. A mutual friendship is two rows (one per direction).';

-- 2.3 groups -----------------------------------------------------------------
create table if not exists public.groups (
  id         uuid              primary key default gen_random_uuid(),
  name       text              not null,
  type       public.group_type not null default 'other',
  created_by uuid              not null references public.profiles (id) on delete cascade,
  created_at timestamptz       not null default now()
);

-- 2.4 group_members — which users belong to which groups ---------------------
create table if not exists public.group_members (
  id        uuid        primary key default gen_random_uuid(),
  group_id  uuid        not null references public.groups (id) on delete cascade,
  user_id   uuid        not null references public.profiles (id) on delete cascade,
  role      text        not null default 'member',
  joined_at timestamptz not null default now(),
  constraint group_members_unique_membership unique (group_id, user_id)
);

-- 2.5 expenses ---------------------------------------------------------------
-- group_id is nullable: a null group means a personal / 1:1 expense.
create table if not exists public.expenses (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        references public.groups (id) on delete restrict,
  title       text        not null,
  description text,
  amount_cents int        not null check (amount_cents >= 0),
  currency    text        not null default 'USD',
  category_id int         not null references public.categories (id),
  expense_date date       not null default current_date,
  paid_by     uuid        not null references public.profiles (id),
  created_by  uuid        not null references public.profiles (id),
  receipt_url text,
  notes       text,
  created_at  timestamptz not null default now()
);

comment on column public.expenses.group_id is
  'Nullable — null denotes a personal / 1:1 expense not tied to a group. Restricted delete protects history (see database-design.md §9).';

-- 2.6 expense_splits — per-person share; source of truth for "who owes what" --
create table if not exists public.expense_splits (
  id          uuid              primary key default gen_random_uuid(),
  expense_id  uuid              not null references public.expenses (id) on delete cascade,
  user_id     uuid              not null references public.profiles (id) on delete cascade,
  share_cents int               not null check (share_cents >= 0),
  split_type  public.split_type not null,
  created_at  timestamptz       not null default now(),
  constraint expense_splits_unique_participant unique (expense_id, user_id)
);

comment on table public.expense_splits is
  'Per-participant share of an expense. Invariant (application-enforced): sum(share_cents) = expenses.amount_cents. Cascades on expense delete.';

-- 2.7 settlements — recorded payments between two users ----------------------
create table if not exists public.settlements (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        references public.groups (id) on delete restrict,
  payer_id    uuid        not null references public.profiles (id),
  receiver_id uuid        not null references public.profiles (id),
  amount_cents int        not null check (amount_cents > 0),
  currency    text        not null default 'USD',
  note        text,
  settled_at  timestamptz not null default now(),
  constraint settlements_distinct_parties check (payer_id <> receiver_id)
);

comment on column public.settlements.group_id is
  'Nullable — null denotes a personal (non-group) settlement.';

-- ============================================================================
-- 3. Indexes (all FK columns + common query paths — database-design.md §5)
-- ============================================================================
create index if not exists idx_friendships_user_id     on public.friendships (user_id);
create index if not exists idx_friendships_friend_id   on public.friendships (friend_id);

create index if not exists idx_groups_created_by        on public.groups (created_by);

create index if not exists idx_group_members_group_id   on public.group_members (group_id);
create index if not exists idx_group_members_user_id    on public.group_members (user_id);

create index if not exists idx_expenses_group_id        on public.expenses (group_id);
create index if not exists idx_expenses_paid_by         on public.expenses (paid_by);
create index if not exists idx_expenses_created_by      on public.expenses (created_by);
create index if not exists idx_expenses_category_id     on public.expenses (category_id);
create index if not exists idx_expenses_expense_date    on public.expenses (expense_date);

create index if not exists idx_expense_splits_expense_id on public.expense_splits (expense_id);
create index if not exists idx_expense_splits_user_id    on public.expense_splits (user_id);

create index if not exists idx_settlements_group_id     on public.settlements (group_id);
create index if not exists idx_settlements_payer_id     on public.settlements (payer_id);
create index if not exists idx_settlements_receiver_id  on public.settlements (receiver_id);

-- ============================================================================
-- 4. RLS helper functions
--
-- All are SECURITY DEFINER so they bypass RLS on the tables they read. This is
-- what breaks the recursion that would otherwise occur when a policy on, say,
-- `group_members` needs to ask "is the caller a member of this group?".
-- ============================================================================

-- True when the current user belongs to group `gid`.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = gid
      and gm.user_id = auth.uid()
  );
$$;

-- True when the current user created (owns) group `gid`.
create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = gid
      and g.created_by = auth.uid()
  );
$$;

-- True when the current user shares at least one group with `other`.
create or replace function public.shares_group_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other
  );
$$;

-- True when the current user may read expense `eid`: a member of its group, a
-- personal party to it (payer / creator), or a participant in its splits.
create or replace function public.can_read_expense(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = eid
      and (
        (e.group_id is not null and public.is_group_member(e.group_id))
        or e.paid_by = auth.uid()
        or e.created_by = auth.uid()
        or exists (
          select 1
          from public.expense_splits s
          where s.expense_id = e.id
            and s.user_id = auth.uid()
        )
      )
  );
$$;

-- True when the current user created expense `eid` (may write its splits).
create or replace function public.owns_expense(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = eid
      and e.created_by = auth.uid()
  );
$$;

-- ============================================================================
-- 5. Row Level Security — enable + policies (deny-by-default)
-- ============================================================================

-- 5.0 profiles — broaden read to friends & co-members (Phase 1 was self-only) -
-- Multiple permissive SELECT policies are OR'd, so this adds to the existing
-- "profiles_select_own" without replacing it.
drop policy if exists "profiles_select_shared" on public.profiles;
create policy "profiles_select_shared"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.friendships f
      where (f.user_id = auth.uid() and f.friend_id = profiles.id)
         or (f.friend_id = auth.uid() and f.user_id = profiles.id)
    )
    or public.shares_group_with(profiles.id)
  );

-- 5.1 categories — read-only reference for all authenticated users -----------
alter table public.categories enable row level security;

drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all"
  on public.categories
  for select
  to authenticated
  using (true);
-- No INSERT/UPDATE/DELETE policies: categories are seeded, never user-writable.

-- 5.2 friendships — a user sees & manages links they are party to ------------
alter table public.friendships enable row level security;

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own"
  on public.friendships
  for select
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friendships_insert_own" on public.friendships;
create policy "friendships_insert_own"
  on public.friendships
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "friendships_delete_own" on public.friendships;
create policy "friendships_delete_own"
  on public.friendships
  for delete
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

-- 5.3 groups — members read; owner edits/deletes ----------------------------
alter table public.groups enable row level security;

drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member"
  on public.groups
  for select
  to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());

drop policy if exists "groups_insert_owner" on public.groups;
create policy "groups_insert_owner"
  on public.groups
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner"
  on public.groups
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner"
  on public.groups
  for delete
  to authenticated
  using (created_by = auth.uid());

-- 5.4 group_members — members read; owner manages, member may leave ----------
alter table public.group_members enable row level security;

drop policy if exists "group_members_select_member" on public.group_members;
create policy "group_members_select_member"
  on public.group_members
  for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "group_members_insert_owner" on public.group_members;
create policy "group_members_insert_owner"
  on public.group_members
  for insert
  to authenticated
  with check (public.is_group_owner(group_id));

drop policy if exists "group_members_update_owner" on public.group_members;
create policy "group_members_update_owner"
  on public.group_members
  for update
  to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));

drop policy if exists "group_members_delete_manage" on public.group_members;
create policy "group_members_delete_manage"
  on public.group_members
  for delete
  to authenticated
  using (public.is_group_owner(group_id) or user_id = auth.uid());

-- 5.5 expenses — visible per can_read_expense; creator writes ----------------
alter table public.expenses enable row level security;

drop policy if exists "expenses_select_visible" on public.expenses;
create policy "expenses_select_visible"
  on public.expenses
  for select
  to authenticated
  using (public.can_read_expense(id));

drop policy if exists "expenses_insert_creator" on public.expenses;
create policy "expenses_insert_creator"
  on public.expenses
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists "expenses_update_creator" on public.expenses;
create policy "expenses_update_creator"
  on public.expenses
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists "expenses_delete_creator" on public.expenses;
create policy "expenses_delete_creator"
  on public.expenses
  for delete
  to authenticated
  using (created_by = auth.uid());

-- 5.6 expense_splits — visible with the expense; written by expense owner -----
alter table public.expense_splits enable row level security;

drop policy if exists "expense_splits_select_visible" on public.expense_splits;
create policy "expense_splits_select_visible"
  on public.expense_splits
  for select
  to authenticated
  using (public.can_read_expense(expense_id));

drop policy if exists "expense_splits_insert_owner" on public.expense_splits;
create policy "expense_splits_insert_owner"
  on public.expense_splits
  for insert
  to authenticated
  with check (public.owns_expense(expense_id));

drop policy if exists "expense_splits_update_owner" on public.expense_splits;
create policy "expense_splits_update_owner"
  on public.expense_splits
  for update
  to authenticated
  using (public.owns_expense(expense_id))
  with check (public.owns_expense(expense_id));

drop policy if exists "expense_splits_delete_owner" on public.expense_splits;
create policy "expense_splits_delete_owner"
  on public.expense_splits
  for delete
  to authenticated
  using (public.owns_expense(expense_id));

-- 5.7 settlements — parties (and group members) read; parties write ----------
alter table public.settlements enable row level security;

drop policy if exists "settlements_select_party" on public.settlements;
create policy "settlements_select_party"
  on public.settlements
  for select
  to authenticated
  using (
    payer_id = auth.uid()
    or receiver_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id))
  );

drop policy if exists "settlements_insert_party" on public.settlements;
create policy "settlements_insert_party"
  on public.settlements
  for insert
  to authenticated
  with check (
    (payer_id = auth.uid() or receiver_id = auth.uid())
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists "settlements_update_party" on public.settlements;
create policy "settlements_update_party"
  on public.settlements
  for update
  to authenticated
  using (payer_id = auth.uid() or receiver_id = auth.uid())
  with check (payer_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "settlements_delete_party" on public.settlements;
create policy "settlements_delete_party"
  on public.settlements
  for delete
  to authenticated
  using (payer_id = auth.uid() or receiver_id = auth.uid());

-- ============================================================================
-- 6. Category seed (static). Idempotent — safe to re-run.
-- ============================================================================
insert into public.categories (id, name, icon) values
  (1, 'Food',          'utensils'),
  (2, 'Transport',     'car'),
  (3, 'Shopping',      'shopping-bag'),
  (4, 'Bills',         'receipt'),
  (5, 'Entertainment', 'clapperboard'),
  (6, 'Travel',        'plane'),
  (7, 'Other',         'ellipsis')
on conflict (id) do nothing;
