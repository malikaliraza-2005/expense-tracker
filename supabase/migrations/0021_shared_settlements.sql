-- ─────────────────────────────────────────────────────────────
-- Migration 0021 — symmetric settlements (either participant can settle)
--
-- The app is a single-owner ledger: A's expense with member "Bob" (linked to
-- account B) lives in A's ledger. 0015 already lets B READ the shared expense, its
-- splits, and the members involved — but NOT the settlements, which stayed
-- owner-only. That gap is why a balance could never be symmetric: B could see what
-- was owed but not what had already been paid, so B's derived net would be wrong.
--
-- This migration closes it with two additions:
--
--   1. settlements_select_shared — a participant may READ settlements involving the
--      member that represents them. Now both sides derive the SAME net from the SAME
--      rows, so the balance can never disagree between accounts.
--
--   2. settle_member() — either party may record ONE settlement into the ledger that
--      owns the balance (the member's owner). The single shared row is what keeps a
--      payment from being recorded twice, once per side.
--
-- The ledger owner remains the single source of truth: nothing is mirrored or
-- duplicated into the other account, so there is no second copy to drift. The amount
-- is validated against the outstanding net in the action (which uses the one balance
-- engine in src/lib/balances.ts) rather than re-implementing that maths in SQL.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. Participants may read the settlements that affect them
--
-- Permissive, alongside the existing owner-scoped policy. Scoped tightly: you only
-- see a settlement when one of its two parties is a member linked to YOUR account.
-- ============================================================================
drop policy if exists settlements_select_shared on public.settlements;
create policy settlements_select_shared
  on public.settlements for select to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id in (settlements.payer_id, settlements.receiver_id)
        and m.linked_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. settle_member — either party records ONE settlement
--
-- `p_member_id` is the member the balance is with, in its owner's ledger (e.g. A's
-- "Bob"). The caller may be either that ledger's owner (A) or the account the member
-- represents (B) — nobody else. `p_member_pays` states the direction from the
-- ledger's point of view (true = the member pays the owner), so both callers agree on
-- it: it's derived from the owner-perspective net, which both compute from the same
-- rows.
--
-- Returns the new settlement id, or null when the caller isn't a party, the member is
-- a self-member, the amount is non-positive, or the group isn't the owner's.
-- SECURITY DEFINER because B writes into A's owner-scoped ledger; the authorization
-- check above is the guard.
-- ============================================================================
create or replace function public.settle_member(
  p_member_id     uuid,
  p_amount_cents  integer,
  p_member_pays   boolean,
  p_group_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_member   public.members%rowtype;
  v_self     uuid;
  v_currency text;
  v_payer    uuid;
  v_receiver uuid;
  v_id       uuid;
begin
  if v_uid is null or p_amount_cents is null or p_amount_cents <= 0 then
    return null;
  end if;

  select * into v_member from public.members where id = p_member_id;
  if not found or v_member.is_self then
    return null; -- you can't settle with yourself
  end if;

  -- Only the ledger owner, or the account this member represents.
  if v_uid <> v_member.owner_id
     and (v_member.linked_user_id is null or v_member.linked_user_id <> v_uid) then
    return null;
  end if;

  select id into v_self
    from public.members
    where owner_id = v_member.owner_id and is_self
    limit 1;
  if v_self is null then
    return null;
  end if;

  -- A group-scoped settlement must belong to the same ledger.
  if p_group_id is not null and not exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.owner_id = v_member.owner_id
  ) then
    return null;
  end if;

  -- Stored in the ledger owner's currency, like every other amount they record.
  select coalesce(nullif(btrim(preferred_currency), ''), 'USD') into v_currency
    from public.profiles where id = v_member.owner_id;

  if p_member_pays then
    v_payer := v_member.id; v_receiver := v_self;
  else
    v_payer := v_self;      v_receiver := v_member.id;
  end if;

  insert into public.settlements (
    owner_id, payer_id, receiver_id, amount_cents, currency, group_id)
  values (
    v_member.owner_id, v_payer, v_receiver, p_amount_cents,
    coalesce(v_currency, 'USD'), p_group_id)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.settle_member is
  'Record ONE settlement against the balance with p_member_id, callable by either the '
  'ledger owner or the account that member represents. Returns the settlement id, or '
  'null when the caller is not a party / the input is invalid.';

grant execute on function public.settle_member(uuid, integer, boolean, uuid) to authenticated;
