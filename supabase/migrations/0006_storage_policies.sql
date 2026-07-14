-- ─────────────────────────────────────────────────────────────
-- Migration 0006 — avatar storage bucket & policies
--
-- Phase 6 (Profile, Search & Polish). Introduces the `avatars` Storage bucket
-- that backs profile avatar uploads. The bucket is PUBLIC for reads (an avatar
-- is shown to every friend/group member who can see the profile, so there is no
-- benefit to signed URLs), but writes are owner-scoped by RLS on
-- `storage.objects`.
--
-- Object key convention (enforced by the policies below and the uploadAvatar
-- action): `<auth.uid()>/<filename>` — i.e. the first path segment is the
-- owner's user id. A user may therefore only create, replace, or delete objects
-- inside their own folder, mirroring the self-only write rule on `profiles`.
--
-- See docs/phases/phase-6-profile-search-polish.md §5 and docs/database-design.md.
-- ─────────────────────────────────────────────────────────────

-- 1. Bucket -----------------------------------------------------------------
-- Public read; 2 MB object-size ceiling; common image mime types only. The
-- action re-validates size/type, but the bucket limits are defense in depth.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Row Level Security on storage.objects ----------------------------------
-- Reads: the bucket is public, so no SELECT policy is required for viewing.
-- Writes: restricted to the owner's own top-level folder. `storage.foldername`
-- splits the object key on '/', so element [1] is the first path segment, which
-- must equal the caller's uid.

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
