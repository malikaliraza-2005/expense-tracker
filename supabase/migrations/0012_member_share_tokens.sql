-- ─────────────────────────────────────────────────────────────
-- Migration 0012 — member share (claim) links
--
-- A read-only, unauthenticated way for one of the owner's people to see where
-- they stand with the owner. The owner mints a per-member share token; anyone
-- with the link sees ONLY that member's balance versus the owner — never the
-- owner's other data. No account, login, or RLS change to the core tables:
-- the public read goes through one SECURITY DEFINER function whose result shape
-- can only ever expose a single member's net.
--
-- Keeps the single-owner model intact (this is Path A — a claim link, not a
-- multi-account rebuild).
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. member_share_tokens — one owner-minted token per share link
-- ============================================================================
create table if not exists public.member_share_tokens (
  token      text        primary key
               default encode(gen_random_bytes(18), 'hex'),
  member_id  uuid        not null references public.members (id)  on delete cascade,
  owner_id   uuid        not null references public.profiles (id) on delete cascade,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.member_share_tokens is
  'An owner-minted, revocable token that lets a named member view (read-only) their balance with the owner via /share/<token>. No account involved.';

create index if not exists idx_member_share_tokens_member_id
  on public.member_share_tokens (member_id);
create index if not exists idx_member_share_tokens_owner_id
  on public.member_share_tokens (owner_id);

-- Only the account owner can see / mint / revoke their own tokens. The public
-- read path does NOT use this table directly — it goes through the function
-- below, which is SECURITY DEFINER.
alter table public.member_share_tokens enable row level security;

drop policy if exists "member_share_tokens_all_own" on public.member_share_tokens;
create policy "member_share_tokens_all_own"
  on public.member_share_tokens for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- 2. member_ledger_by_token — the public, read-only balance for a token
--
-- Resolves a (non-revoked) token to its member and computes that member's net
-- versus the owner's self-member, per currency. Positive net_cents = the member
-- owes the owner; negative = the owner owes the member. Returns no rows for an
-- invalid/revoked token. Always emits one names-carrying row (currency null,
-- net 0) when the pair is settled, so the page can still greet by name.
--
-- SECURITY DEFINER + granted to anon: callable without a session, but its result
-- shape only ever reveals ONE member's figures — never the owner's other data.
-- ============================================================================
create or replace function public.member_ledger_by_token(p_token text)
returns table (
  member_name text,
  owner_name  text,
  currency    text,
  net_cents   bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member      uuid;
  v_owner       uuid;
  v_self        uuid;
  v_member_name text;
  v_owner_name  text;
begin
  select t.member_id, t.owner_id
    into v_member, v_owner
  from public.member_share_tokens t
  where t.token = p_token and t.revoked_at is null;

  if v_member is null then
    return; -- invalid or revoked: no rows
  end if;

  select m.name into v_member_name from public.members m where m.id = v_member;
  select coalesce(nullif(btrim(p.full_name), ''), 'The owner')
    into v_owner_name
  from public.profiles p where p.id = v_owner;

  select m.id into v_self
  from public.members m
  where m.owner_id = v_owner and m.is_self
  limit 1;

  return query
  with exp_nets as (
    select e.currency as cur,
      sum(
        case
          when s.member_id = v_member and e.paid_by = v_self then s.share_cents
          when s.member_id = v_self and e.paid_by = v_member then -s.share_cents
          else 0
        end
      ) as cents
    from public.expenses e
    join public.expense_splits s on s.expense_id = e.id
    where e.owner_id = v_owner
    group by e.currency
  ),
  settle_nets as (
    select st.currency as cur,
      sum(
        case
          when st.payer_id = v_member and st.receiver_id = v_self then -st.amount_cents
          when st.payer_id = v_self and st.receiver_id = v_member then st.amount_cents
          else 0
        end
      ) as cents
    from public.settlements st
    where st.owner_id = v_owner
    group by st.currency
  ),
  combined as (
    select cur, sum(cents) as net
    from (
      select cur, cents from exp_nets
      union all
      select cur, cents from settle_nets
    ) u
    group by cur
    having sum(cents) <> 0
  )
  select v_member_name, v_owner_name, c.cur, c.net::bigint
  from combined c
  union all
  select v_member_name, v_owner_name, null::text, 0::bigint
  where not exists (select 1 from combined);
end;
$$;

comment on function public.member_ledger_by_token is
  'Public read for a share link: resolves a token to its member and returns that member''s per-currency net versus the owner. No rows for an invalid/revoked token.';

-- The /share page is unauthenticated, so anon must be able to call this. Safe:
-- the function only ever returns one member''s balance.
grant execute on function public.member_ledger_by_token(text) to anon, authenticated;
