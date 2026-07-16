-- ─────────────────────────────────────────────────────────────
-- Migration 0013 — optional email on members
--
-- Members stay owner-managed, name-based people (no accounts). This adds an
-- OPTIONAL contact email so the owner can record how to reach someone, dedupe
-- people by email when adding them, and invite people who aren't in the app yet.
-- It is not a login or a cross-account link — the single-owner model is intact.
-- ─────────────────────────────────────────────────────────────

alter table public.members
  add column if not exists email text
  check (email is null or length(btrim(email)) <= 200);

comment on column public.members.email is
  'Optional owner-entered contact email for the member. Not an account or login — used for display, dedupe, and invites only.';

-- Speeds up email-first lookups when adding/deduping people.
create index if not exists idx_members_owner_email
  on public.members (owner_id, lower(email))
  where email is not null;
