-- ─────────────────────────────────────────────────────────────
-- Migration 0028 — close an account-takeover chain in the invite flow
--
-- ***** APPLY THIS ONE FIRST. It is not a cleanup; it closes a live hole. *****
--
-- Every step below was EXPLOITED against the live database before this was written —
-- none of it is theoretical.
--
-- THE CHAIN (attacker Mallory, victim Alice):
--   1. `invitations`' write policy checks `inviter_id = auth.uid()` and NOTHING about
--      `member_id`. FK validation doesn't apply RLS, so Mallory can insert an invitation
--      pointing at ANY member uuid — including one from Alice's roster. She learns such a
--      uuid the normal way: 0015 lets her read every split row of any expense shared with
--      her, and 0023 every `group_members` row of a group she's in.
--   2. `accept_invite` checks the token, the status, the expiry, `is_self`, and that the
--      member is unlinked — but NEVER that the INVITER OWNS THE MEMBER. So Mallory
--      accepts her own invitation and the RPC, as SECURITY DEFINER, runs
--      `update members set linked_user_id = mallory` on ALICE's member. RLS is bypassed;
--      Alice is never asked and never told.
--   3. Mallory is now the "linked account" of Alice's member. `can_see_expense` is not
--      scoped to one expense or group, so this grants her, across Alice's ENTIRE ledger:
--      every expense that member pays or participates in (0015), co-participant member
--      rows (0015), their settlements (0021), their chat threads (0017), the groups
--      (0023) — and WRITE access via settle_member/unsettle_member (0021/0026).
--      Name-only members have no account, so nobody is notified that a stranger has
--      claimed them.
--
-- Verified end-to-end: the invitation inserted, accept_invite returned '/dashboard',
-- the victim's member came back linked to the attacker, the attacker then read the
-- victim's private expense and wrote a settlement into the victim's ledger.
--
-- The app was never the problem — `inviteMemberByEmail` scopes its member lookup with
-- `.eq('owner_id', user.id)`. But PostgREST exposes the tables and RPCs directly to any
-- user's JWT, so a Server Action is not a trust boundary. The rule has to live here.
--
-- Fixed in BOTH halves, because either alone leaves the other open:
--   (1) the policy stops the bogus invitation existing, and
--   (2) the RPC refuses to honour one that already exists (rows may already be out there).
--
-- Also closes two related holes found in the same audit — see sections 3 and 4.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. An invitation may only point at a member the inviter OWNS
--
-- The `members` subquery is safe from RLS recursion: `members`' own policies resolve
-- through SECURITY DEFINER helpers (0015's can_see_member), which never re-enter
-- `invitations`. It also fails CLOSED — the `owner_id = auth.uid()` predicate is what
-- decides, so even though the attacker CAN read the victim's member row, it isn't hers.
-- ============================================================================
drop policy if exists invitations_all_own on public.invitations;
create policy invitations_all_own
  on public.invitations for all to authenticated
  using (inviter_id = auth.uid())
  with check (
    inviter_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = invitations.member_id
        and m.owner_id = auth.uid()
    )
  );

comment on policy invitations_all_own on public.invitations is
  'Your own invitations, and only for members you own. The member_id check is what stops '
  'an invitation being aimed at another ledger''s member — see migration 0028.';

-- ============================================================================
-- 2. accept_invite — the inviter must own the member being claimed
--
-- The single check that breaks the chain. Kept as a `return null` so it fails exactly
-- like every other rejected invite (the caller learns nothing about why).
--
-- Replaces 0016's definition verbatim apart from this guard.
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

  -- *** The escalation guard (0028). ***
  -- You may only hand out a claim on YOUR OWN member. Without this, an invitation
  -- crafted against another ledger's member id links the accepter straight into that
  -- ledger — this function is SECURITY DEFINER, so the victim's RLS never sees it.
  if v_member.owner_id <> v_inv.inviter_id then
    return null;
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
  'Claim the member an invite names, returning where to land. The inviter must OWN that '
  'member (0028) — otherwise a crafted invite would link the accepter into a stranger''s '
  'ledger. Never claims a self-member or one already linked elsewhere.';

-- ============================================================================
-- 3. `members.linked_user_id` is established by accepting an invite, never by a client
--
-- Also exploited: `members_all_own`'s check constrains only `owner_id`, so a client can
-- INSERT a member of their own carrying `linked_user_id = <any stranger>`. That forges
-- the "connected account" test `log_activity` uses:
--
--     where (m.owner_id = v_uid and m.linked_user_id = v_owner) or ...
--
-- — a row in the ATTACKER's own roster. With it, arbitrary events (type, amount,
-- subject, currency, deep-links) can be injected into a stranger's feed, under an
-- actor_name the attacker controls via their own profile. Confirmed: a forged
-- "settlement_received … 5,000,000" landed in the victim's feed. Reads do NOT leak this
-- way (can_see_expense matches the opposite direction), so this is feed spoofing /
-- phishing rather than data theft — but the notification is indistinguishable from real.
--
-- A `with check` can't express this: `members_all_own` is FOR ALL, so any check on
-- linked_user_id would also be re-evaluated when the OWNER later renames a member that
-- accept_invite legitimately linked — breaking renameMember. A trigger can compare
-- OLD/NEW and see who is calling.
--
-- The guard function is deliberately SECURITY INVOKER: `current_user` must reflect the
-- real caller. PostgREST arrives as `authenticated`/`anon`; inside a SECURITY DEFINER
-- RPC (accept_invite) it is the function owner, so the invite flow passes untouched.
-- ============================================================================
create or replace function public.members_link_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.linked_user_id is not null then
      raise exception 'linked_user_id is established by accepting an invite, not by the client'
        using errcode = 'check_violation';
    elsif tg_op = 'UPDATE' and new.linked_user_id is distinct from old.linked_user_id then
      raise exception 'linked_user_id is established by accepting an invite, not by the client'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.members_link_guard is
  'Only the invite RPCs (SECURITY DEFINER) may set or change members.linked_user_id. A '
  'client-forged link would satisfy log_activity''s connected-account test and allow '
  'notification spoofing into a stranger''s feed. See migration 0028.';

drop trigger if exists members_link_guard on public.members;
create trigger members_link_guard
  before insert or update of linked_user_id on public.members
  for each row execute function public.members_link_guard();

-- ============================================================================
-- 4. Two SECURITY DEFINER functions were callable with no session at all
--
-- A fresh `create function` carries a default EXECUTE grant to PUBLIC, and `anon` is a
-- member of PUBLIC — so `grant execute ... to authenticated` ADDS nothing and restricts
-- nothing. Both were confirmed callable with only the anon key (which ships in the
-- client bundle by design):
--
--   * find_profile_by_email — 0007 revoked it from public with the comment "Executable
--     by authenticated users only". 0010 then DROPPED the function (discarding its ACL)
--     and 0016 recreated it without the revoke, silently undoing that hardening. It
--     reads auth.users, so it is an unauthenticated email -> account-id oracle over the
--     whole user base: confirmed returning a victim's uuid for their email, no session.
--     That uuid is the input the section-3 forgery needs.
--   * assert_expense_refs — an internal helper taking the owner as an ARGUMENT and never
--     comparing it to auth.uid(). Confirmed reachable anonymously, where its distinct
--     error messages confirm whether a given group/member belongs to a given owner. Its
--     only callers are the DEFINER expense RPCs, which run as the owner and don't need a
--     grant at all.
--
-- Revoking from PUBLIC is what actually restricts; the explicit re-grant is what keeps
-- the app working. Belt and braces on `anon` in case it was granted directly.
-- ============================================================================
revoke all on function public.find_profile_by_email(text) from public;
revoke all on function public.find_profile_by_email(text) from anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

revoke all on function public.assert_expense_refs(uuid, uuid, uuid, jsonb) from public;
revoke all on function public.assert_expense_refs(uuid, uuid, uuid, jsonb) from anon;
revoke all on function public.assert_expense_refs(uuid, uuid, uuid, jsonb) from authenticated;

comment on function public.find_profile_by_email is
  'Account id for an email, or null. SECURITY DEFINER to read auth.users; authenticated '
  'ONLY — revoked from public/anon in 0028, which restored the intent 0007 stated and '
  '0010/0016 lost. Without it this is an anonymous account-enumeration oracle.';
