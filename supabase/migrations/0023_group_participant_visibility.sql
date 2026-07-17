-- ─────────────────────────────────────────────────────────────
-- Migration 0023 — a participant can open the group they were added to
--
-- Bug: when A adds B to a group, B gets an "Ali added you to Trip to Naran"
-- notification that deep-links to /groups/<id> — but `groups_all_own` (0010) is
-- owner-only, so B cannot read the group row, getGroup() returns null and the page
-- 404s. The notification is addressed to B, and B was the one person who couldn't
-- open it.
--
-- This grants a *participant* read access to the group they belong to: someone with a
-- linked member in that group's membership. Read-only and additive — creating,
-- renaming, and deleting stay owner-only via the existing `groups_all_own`.
--
-- RECURSION NOTE: `groups_all_own` is deliberately written so groups' policy never
-- references group_members (see 0010's comment) — group_members' policy reads groups,
-- and if groups' policy read group_members back, RLS evaluation would recurse. So the
-- check goes in a SECURITY DEFINER helper, which bypasses RLS internally and breaks
-- the cycle (the same pattern 0015 uses for can_see_expense).
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- can_see_group — may auth.uid() read this group?
--
-- True for the owner, or for a participant: a member of the group that is linked to
-- the caller's account. SECURITY DEFINER so it can read groups/group_members/members
-- without RLS (avoiding the policy recursion described above); it returns only a
-- boolean.
-- ============================================================================
create or replace function public.can_see_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.owner_id = auth.uid()
  ) or exists (
    select 1
    from public.group_members gm
    join public.members m on m.id = gm.member_id
    where gm.group_id = p_group_id and m.linked_user_id = auth.uid()
  );
$$;

comment on function public.can_see_group is
  'True when auth.uid() may read a group: its owner, or a participant (a group member '
  'linked to their account). SECURITY DEFINER to avoid groups<->group_members RLS '
  'recursion.';

grant execute on function public.can_see_group(uuid) to authenticated;

-- ============================================================================
-- Read-only participant visibility (permissive, alongside the owner policies)
-- ============================================================================
drop policy if exists "groups_select_participant" on public.groups;
create policy "groups_select_participant"
  on public.groups for select to authenticated
  using (public.can_see_group(id));

-- So the group's member list renders for a participant too.
drop policy if exists "group_members_select_participant" on public.group_members;
create policy "group_members_select_participant"
  on public.group_members for select to authenticated
  using (public.can_see_group(group_id));
