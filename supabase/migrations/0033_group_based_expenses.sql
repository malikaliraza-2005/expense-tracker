-- 0033_group_based_expenses.sql
--
-- Make EVERY expense belong to a group. The app previously modelled a
-- "general / ungrouped" expense as expenses.group_id = NULL. We eliminate that:
-- each owner gets a per-owner "Personal" group (groups.is_personal) that absorbs
-- quick-adds and the existing null rows, then expenses.group_id becomes NOT NULL.
--
-- settlements.group_id is intentionally LEFT nullable: an "overall" settle-up with
-- a friend spans multiple groups and is a transfer, not an expense.
--
-- Apply by hand in Supabase (this repo's migrations are run manually).

begin;

-- 1. Flag a group as its owner's Personal (default) group — at most one per owner.
alter table public.groups
  add column if not exists is_personal boolean not null default false;

create unique index if not exists groups_one_personal_per_owner
  on public.groups (owner_id)
  where is_personal;

-- 2. Give every existing owner a Personal group (idempotent).
insert into public.groups (owner_id, name, type, is_personal)
select p.id, 'Personal', 'other', true
from public.profiles p
where not exists (
  select 1 from public.groups g
  where g.owner_id = p.id and g.is_personal
);

-- Ensure the owner's self-member is a member of their Personal group so they can
-- pay / share in it (mirrors createGroup's self-member insert).
insert into public.group_members (group_id, member_id)
select g.id, m.id
from public.groups g
join public.members m on m.owner_id = g.owner_id and m.is_self
where g.is_personal
  and not exists (
    select 1 from public.group_members gm
    where gm.group_id = g.id and gm.member_id = m.id
  );

-- 3. Move existing ungrouped expenses into their owner's Personal group.
update public.expenses e
set group_id = g.id
from public.groups g
where e.group_id is null
  and g.owner_id = e.owner_id
  and g.is_personal;

-- 4. Enforce the invariant from here on.
alter table public.expenses
  alter column group_id set not null;

-- 5. ensure_personal_group(): the caller's Personal group id, created on demand
--    (mirrors ensure_self_member in 0010). Used at runtime so a brand-new owner
--    always has a home for their first expense.
create or replace function public.ensure_personal_group()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
  v_self  uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select id into v_group
  from public.groups
  where owner_id = auth.uid() and is_personal
  limit 1;

  if v_group is null then
    insert into public.groups (owner_id, name, type, is_personal)
    values (auth.uid(), 'Personal', 'other', true)
    returning id into v_group;
  end if;

  -- Make sure the owner's self-member belongs to it.
  v_self := public.ensure_self_member();
  if v_self is not null then
    insert into public.group_members (group_id, member_id)
    values (v_group, v_self)
    on conflict (group_id, member_id) do nothing;
  end if;

  return v_group;
end;
$$;

comment on function public.ensure_personal_group is
  'Returns the caller''s Personal group id, creating it (and adding their self-member) on first call.';

commit;
