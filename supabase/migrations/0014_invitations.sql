-- ─────────────────────────────────────────────────────────────
-- Migration 0014 — email invitations & claimed members (Phase 1)
--
-- The first step of the multi-account collaboration model. Today every member is
-- a name-only person owned by one account and no second logged-in user can ever
-- see another's data. This migration lets the owner INVITE a member by email:
-- the recipient registers, and their real account *claims* that member row
-- (members.linked_user_id). Name-only members keep working exactly as before —
-- claiming is purely additive and unlocks the cross-user view/chat in later
-- phases.
--
-- The public accept path (an unauthenticated invitee reading their invite, and
-- the authenticated accept) goes through two SECURITY DEFINER functions, mirroring
-- the member_ledger_by_token pattern in 0012 — the core tables' owner-only RLS is
-- untouched.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. members.linked_user_id — the real account (if any) that claimed this member
-- ============================================================================
alter table public.members
  add column if not exists linked_user_id uuid
  references public.profiles (id) on delete set null;

comment on column public.members.linked_user_id is
  'The real account that has claimed this member via an accepted email invite. Null = a plain name-only member (the default). Set by accept_invite().';

-- One account can claim a given owner's member at most once. (A user may still be
-- linked to members under different owners — this only dedupes within one owner.)
create unique index if not exists uidx_members_owner_linked_user
  on public.members (owner_id, linked_user_id)
  where linked_user_id is not null;

-- ============================================================================
-- 2. invitations — one owner-minted email invite per (member, email)
-- ============================================================================
create table if not exists public.invitations (
  id                uuid        primary key default gen_random_uuid(),
  inviter_id        uuid        not null references public.profiles (id) on delete cascade,
  member_id         uuid        not null references public.members  (id) on delete cascade,
  email             text        not null,
  token             text        not null unique
                      default encode(gen_random_bytes(18), 'hex'),
  target_expense_id uuid        references public.expenses (id) on delete set null,
  target_group_id   uuid        references public.groups   (id) on delete set null,
  status            text        not null default 'pending'
                      check (status in ('pending', 'accepted', 'revoked', 'expired')),
  accepted_user_id  uuid        references public.profiles (id) on delete set null,
  accepted_at       timestamptz,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '14 days')
);

comment on table public.invitations is
  'An owner-minted email invite asking the recipient to register and claim a member row. The accept path runs through accept_invite() (SECURITY DEFINER); the owner manages their own rows under RLS.';

create index if not exists idx_invitations_inviter_id on public.invitations (inviter_id);
create index if not exists idx_invitations_member_id  on public.invitations (member_id);
-- At most one live (pending) invite per member+email, so re-inviting reuses the link.
create unique index if not exists uidx_invitations_pending_member_email
  on public.invitations (member_id, lower(email))
  where status = 'pending';

alter table public.invitations enable row level security;

-- Only the inviter (account owner) can see / create / revoke their own invites.
-- The invitee never touches this table directly — they go through the functions
-- below, which are SECURITY DEFINER.
drop policy if exists "invitations_all_own" on public.invitations;
create policy "invitations_all_own"
  on public.invitations for all to authenticated
  using (inviter_id = auth.uid())
  with check (inviter_id = auth.uid());

-- ============================================================================
-- 3. invite_details — public, read-only display info for an invite token
--
-- Lets the unauthenticated /invite/<token> page greet the invitee and prefill the
-- register form, without exposing anything beyond this one invite. Reports the
-- effective status (a past-expiry 'pending' invite reads as 'expired'). Returns no
-- rows for an unknown token.
-- ============================================================================
create or replace function public.invite_details(p_token text)
returns table (
  email        text,
  inviter_name text,
  member_name  text,
  status       text
)
language sql
security definer
set search_path = public
as $$
  select
    i.email,
    coalesce(nullif(btrim(p.full_name), ''), 'Someone') as inviter_name,
    m.name as member_name,
    case
      when i.status = 'pending' and i.expires_at < now() then 'expired'
      else i.status
    end as status
  from public.invitations i
  join public.profiles p on p.id = i.inviter_id
  join public.members  m on m.id = i.member_id
  where i.token = p_token;
$$;

comment on function public.invite_details is
  'Public read for an invite link: display-only fields (invitee email, inviter/member names, effective status) for one token. No rows for an unknown token.';

grant execute on function public.invite_details(text) to anon, authenticated;

-- ============================================================================
-- 4. accept_invite — the authenticated invitee claims their member row
--
-- Validates a pending, unexpired token, links the member to auth.uid(), marks the
-- invitation accepted, and returns the app route to land on (the target expense /
-- group, else the dashboard). Idempotent: re-accepting one's own already-accepted
-- invite just returns the route again. Returns null for an invalid / expired /
-- someone-else's-already-claimed invite. SECURITY DEFINER so it can write the
-- inviter-owned member/invitation rows the invitee cannot touch directly.
-- ============================================================================

-- The route an accepted invite lands on: the target expense, then group, then home.
create or replace function public._invite_route(p_inv public.invitations)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_inv.target_expense_id is not null then '/expenses/' || p_inv.target_expense_id
    when p_inv.target_group_id   is not null then '/groups/'   || p_inv.target_group_id
    else '/dashboard'
  end;
$$;

create or replace function public.accept_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_inv    public.invitations%rowtype;
  v_member public.members%rowtype;
begin
  if v_uid is null then
    return null; -- must be signed in to accept
  end if;

  select * into v_inv from public.invitations where token = p_token;
  if not found then
    return null;
  end if;

  select * into v_member from public.members where id = v_inv.member_id;
  if not found or v_member.is_self then
    return null; -- the owner's own self-member can never be claimed
  end if;

  -- Idempotent re-accept of one's own invite: just return the route again.
  if v_inv.status = 'accepted' then
    if v_inv.accepted_user_id = v_uid then
      return public._invite_route(v_inv);
    end if;
    return null; -- accepted by someone else
  end if;

  -- Only a still-pending, unexpired invite can be accepted.
  if v_inv.status <> 'pending' then
    return null;
  end if;
  if v_inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    return null;
  end if;

  -- The member must be free, or already linked to this same user.
  if v_member.linked_user_id is not null and v_member.linked_user_id <> v_uid then
    return null;
  end if;

  update public.members set linked_user_id = v_uid where id = v_member.id;
  update public.invitations
    set status = 'accepted', accepted_user_id = v_uid, accepted_at = now()
    where id = v_inv.id;

  return public._invite_route(v_inv);
end;
$$;

comment on function public.accept_invite is
  'Authenticated accept: links the invite''s member to auth.uid(), marks the invite accepted, and returns the route to land on. Null for an invalid/expired/foreign invite.';

grant execute on function public.accept_invite(text) to authenticated;
