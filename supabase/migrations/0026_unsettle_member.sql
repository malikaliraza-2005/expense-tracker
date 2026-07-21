-- ─────────────────────────────────────────────────────────────
-- Migration 0026 — a participant can undo a settlement they recorded
--
-- Live bug this fixes (reproduced against the database):
--   0021 let EITHER party record a settlement into the ledger that owns the balance
--   (`settle_member`), but the only WRITE policy on `settlements` is still
--   `settlements_all_own` (owner_id = auth.uid()). So when the participant tried to
--   remove that payment, the DELETE matched ZERO rows — and RLS reports that as
--   success, not as an error. `deleteSettlement` only inspects `error`, so it returned
--   ok:true, the UI said the payment was removed, and the payment was still there.
--
--   Settling was made symmetric in 0021; un-settling was not. This closes that half.
--
-- `unsettle_member` mirrors `settle_member` exactly: SECURITY DEFINER (the participant
-- deletes from someone else's owner-scoped ledger), with the same authorization test —
-- the ledger owner, or the account a party-member represents. It returns whether a row
-- actually went, so the action can stop claiming success when nothing happened.
--
-- Deliberately NOT done as a new RLS DELETE policy: the row is inside the owner's
-- ledger, and widening the table's write policy would also let a participant delete
-- settlements between OTHER pairs in that ledger. The RPC keeps the grant narrow.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

create or replace function public.unsettle_member(p_settlement_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.settlements%rowtype;
begin
  if v_uid is null or p_settlement_id is null then
    return false;
  end if;

  select * into v_row from public.settlements where id = p_settlement_id;
  if not found then
    return false; -- already gone, or not a real settlement
  end if;

  -- Same gate as settle_member: the ledger owner, or the account that one of the two
  -- party-members represents. Nobody else.
  if v_row.owner_id <> v_uid and not exists (
    select 1 from public.members m
    where m.id in (v_row.payer_id, v_row.receiver_id)
      and m.linked_user_id = v_uid
  ) then
    return false;
  end if;

  delete from public.settlements where id = p_settlement_id;
  return true;
end;
$$;

comment on function public.unsettle_member is
  'Remove a settlement, callable by either the ledger owner or the account a party '
  'member represents (mirrors settle_member). Returns true when a row was actually '
  'deleted, so callers can''t report success on a no-op.';

grant execute on function public.unsettle_member(uuid) to authenticated;
