-- ─────────────────────────────────────────────────────────────
-- Migration 0020 — richer activity notifications (deep-links + settlement context)
--
-- Extends the 0018 activity feed so every notification can (a) name its context and
-- (b) deep-link to the resource it's about:
--
--   • settlement_id  — links a settlement notification to the settlement itself
--     (populated by the shared-settlement work; nullable until then).
--   • context_label  — the denormalized name of the group/expense the event happened
--     in, so a settlement can read "Ali settled PKR 2,500 with Ahmed in 'Trip to
--     Naran'" without a cross-account join (the recipient often can't read the group
--     row under RLS).
--
-- The *navigation target* is deliberately NOT stored: it is derived at render from the
-- ids already on the row (expense_id → the expense, group_id → the group, …). Deriving
-- keeps links from going stale if routes change, and there's no second source of truth
-- to keep in sync.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

alter table public.activity_events
  add column if not exists settlement_id uuid
    references public.settlements(id) on delete set null;

alter table public.activity_events
  add column if not exists context_label text;

comment on column public.activity_events.settlement_id is
  'The settlement this event is about, when applicable. SET NULL on delete so the '
  'history survives.';
comment on column public.activity_events.context_label is
  'Denormalized name of the group/expense the event happened in (e.g. "Trip to '
  'Naran"), so the feed renders full context without cross-account reads.';

-- ============================================================================
-- log_activity — accept the two new fields (same contract + guards otherwise)
-- ============================================================================
create or replace function public.log_activity(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_name  text;
  v_event jsonb;
  v_owner uuid;
  v_count int := 0;
begin
  if v_uid is null or p_events is null then
    return 0;
  end if;
  select full_name into v_name from public.profiles where id = v_uid;

  for v_event in select * from jsonb_array_elements(p_events) loop
    v_owner := nullif(v_event->>'owner_id', '')::uuid;
    if v_owner is null then
      continue;
    end if;
    -- own feed, or a connected account's feed (shared linked member either way)
    if v_owner <> v_uid and not exists (
      select 1 from public.members m
      where (m.owner_id = v_uid   and m.linked_user_id = v_owner)
         or (m.owner_id = v_owner and m.linked_user_id = v_uid)
    ) then
      continue;
    end if;

    insert into public.activity_events (
      owner_id, type, actor_id, actor_name, subject,
      expense_id, group_id, member_id, settlement_id,
      amount_cents, currency, context_label)
    values (
      v_owner,
      v_event->>'type',
      v_uid,
      v_name,
      nullif(v_event->>'subject', ''),
      nullif(v_event->>'expense_id', '')::uuid,
      nullif(v_event->>'group_id', '')::uuid,
      nullif(v_event->>'member_id', '')::uuid,
      nullif(v_event->>'settlement_id', '')::uuid,
      nullif(v_event->>'amount_cents', '')::int,
      nullif(v_event->>'currency', ''),
      nullif(v_event->>'context_label', ''));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.log_activity is
  'Append activity events (JSON array) to feeds. Pins actor_id = auth.uid(); a caller '
  'may only write to their own feed or a connected account''s feed. Returns count.';

grant execute on function public.log_activity(jsonb) to authenticated;
