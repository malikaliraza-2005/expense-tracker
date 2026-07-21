-- ─────────────────────────────────────────────────────────────
-- Migration 0016 — friend requests (Phase 4, extended by Phase 5)
--
-- Phase 1 (0014) let an owner email one of their people an invite to register and
-- CLAIM a member row (members.linked_user_id). This migration turns that same rail
-- into a Friends feature: adding a friend by email now branches on whether the
-- recipient already has an account.
--
--   • Recipient HAS an account  → an in-app *friend request*: an `invitations` row
--     with `kind = 'friend'` and no target_expense_id. They see it on their
--     Requests page (Phase 5) and can accept or reject it.
--   • Recipient has NO account → the existing email-invite path (kind = 'member',
--     0014) asking them to register and claim the member row.
--
-- What Phase 4 adds here:
--   1. invitations.kind — 'member' (default, the 0014 behaviour) vs 'friend'.
--   2. A 'rejected' status (plus 'clarifying', reserved for Phase 5's note thread).
--   3. A recipient-visible SELECT policy — today `invitations` is inviter-only, so
--      the Requests "Received" tab would see nothing without this.
--   4. find_profile_by_email — a SECURITY DEFINER lookup that answers "does this
--      email have an account?" so add-by-email can route request vs. invite.
--   5. reject_invite — a party to an invite flips it to 'rejected'.
--
-- What Phase 5 adds here (see the block at the bottom of this file):
--   6. accept_invite is REPLACED so that accepting a 'friend' request also creates
--      the *reciprocal* linked member in the accepter's roster — the friendship
--      then shows on both sides, not just the inviter's.
--
-- (Phase 5's "Clarifications" note-thread was dropped by decision — that
-- conversation belongs in Phase 6 chat — so no `invitation_notes` table is added;
-- the 'clarifying' status reserved above simply stays unused for now.) All of this
-- is additive; the owner-only write rails from 0014 are intact.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. invitations.kind — distinguish a member invite from a friend request
-- ============================================================================
alter table public.invitations
  add column if not exists kind text not null default 'member'
  check (kind in ('member', 'friend'));

comment on column public.invitations.kind is
  'member = an email invite to register and claim a member row (0014, default); '
  'friend = an in-app friend request to an existing account. Set by addFriend().';

-- ============================================================================
-- 2. Widen the status check to allow rejection ('clarifying' reserved for Phase 5)
-- ============================================================================
alter table public.invitations drop constraint if exists invitations_status_check;
alter table public.invitations add constraint invitations_status_check
  check (status in ('pending', 'accepted', 'revoked', 'expired', 'rejected', 'clarifying'));

-- ============================================================================
-- 3. Recipient-visible SELECT policy
--
-- Additive (permissive) alongside 0014's inviter-only `invitations_all_own`. A
-- recipient may READ an invite addressed to them — either already linked to their
-- account (accepted_user_id) or simply sent to their email — so the Requests
-- "Received" tab can list it. Writes stay governed by `invitations_all_own`
-- (owner-only) and the SECURITY DEFINER accept/reject functions.
-- ============================================================================
drop policy if exists "invitations_select_recipient" on public.invitations;
create policy "invitations_select_recipient"
  on public.invitations for select to authenticated
  using (
    accepted_user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ============================================================================
-- 4. find_profile_by_email — does an account exist for this email?
--
-- Returns that account's profile id, or null when no account has the email. Route
-- add-by-email with it: a hit → an in-app friend request; a miss → an email invite.
-- SECURITY DEFINER so it can read auth.users (the caller cannot); it exposes only a
-- single id / null, never any profile or auth detail. Callers must still be
-- authenticated.
-- ============================================================================
create or replace function public.find_profile_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(p_email))
  limit 1;
$$;

comment on function public.find_profile_by_email is
  'Account id for an email, or null. SECURITY DEFINER to read auth.users; returns '
  'only a single id so add-by-email can route friend-request vs email-invite.';

grant execute on function public.find_profile_by_email(text) to authenticated;

-- ============================================================================
-- 5. reject_invite — a party to an invite declines it
--
-- Flips a pending/clarifying invite the caller received (linked to their account or
-- addressed to their email) to 'rejected'. Returns true when a row changed, false
-- otherwise. SECURITY DEFINER because the invite row is inviter-owned; the WHERE
-- clause is the authorization guard (only the recipient can reject).
-- ============================================================================
create or replace function public.reject_invite(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed boolean;
begin
  update public.invitations
    set status = 'rejected'
    where token = p_token
      and status in ('pending', 'clarifying')
      and (
        accepted_user_id = auth.uid()
        or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

comment on function public.reject_invite is
  'Recipient declines a pending/clarifying invite (matched by their account or '
  'email), flipping it to rejected. Returns true when a row changed.';

grant execute on function public.reject_invite(text) to authenticated;

-- ============================================================================
-- 6. accept_invite — Phase 5: reciprocal friend-linking
--
-- Replaces the 0014 accept so a mutual friendship is created in one step. All the
-- original behaviour is preserved (validate token, claim the inviter's member row,
-- mark accepted, return the landing route, idempotent re-accept). The one addition:
-- when the accepted invite is a friend request (kind = 'friend'), also give the
-- ACCEPTER a member representing the inviter, linked to the inviter's account — so
-- the friendship shows on both rosters instead of only the inviter's.
--
-- If the accepter already had a plain contact with the inviter's email, that row is
-- linked in place (no duplicate); otherwise a fresh linked member is created. The
-- (owner_id, linked_user_id) unique index from 0014 keeps this idempotent. Still
-- SECURITY DEFINER — it reads profiles/auth.users and writes inviter-owned rows the
-- accepter cannot touch directly.
-- ============================================================================
create or replace function public.accept_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_inv            public.invitations%rowtype;
  v_member         public.members%rowtype;
  v_inviter_name   text;
  v_inviter_email  text;
  v_existing       uuid;
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

  -- Only a still-pending, unexpired invite can be accepted. (A 'clarifying' invite
  -- would first be moved back to pending; that flow is deferred with Phase 6 chat.)
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

  -- Reciprocal link (friend requests only): the accepter gets a member for the
  -- inviter, so both rosters show the friendship. No-op if one already exists.
  if v_inv.kind = 'friend'
     and not exists (
       select 1 from public.members
       where owner_id = v_uid and linked_user_id = v_inv.inviter_id
     ) then
    select p.full_name, u.email
      into v_inviter_name, v_inviter_email
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.id = v_inv.inviter_id;

    -- Prefer linking an existing same-email contact over creating a duplicate.
    select id into v_existing
      from public.members
      where owner_id = v_uid
        and linked_user_id is null
        and v_inviter_email is not null
        and lower(email) = lower(v_inviter_email)
      order by created_at
      limit 1;

    if v_existing is not null then
      update public.members set linked_user_id = v_inv.inviter_id where id = v_existing;
    else
      insert into public.members (owner_id, name, email, linked_user_id)
      values (
        v_uid,
        coalesce(
          nullif(btrim(v_inviter_name), ''),
          nullif(split_part(coalesce(v_inviter_email, ''), '@', 1), ''),
          'Friend'
        ),
        v_inviter_email,
        v_inv.inviter_id
      );
    end if;
  end if;

  return public._invite_route(v_inv);
end;
$$;

comment on function public.accept_invite is
  'Authenticated accept: links the invite''s member to auth.uid(), marks the invite '
  'accepted, and (for friend requests) creates the reciprocal linked member in the '
  'accepter''s roster so the friendship is mutual. Returns the landing route, or '
  'null for an invalid/expired/foreign invite.';

grant execute on function public.accept_invite(text) to authenticated;
