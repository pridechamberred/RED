-- incREDible — migration 010
-- Members can upload a profile picture, shown instead of their initials.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard > SQL Editor > New
-- query). It is idempotent: safe to re-run.
--
-- Purely additive. Nothing is dropped and no existing row changes: members
-- without a picture keep `avatar_url = null` and keep rendering initials.

-- 1. Where the picture lives.
--
--    Nullable with no default, because "no picture" is the honest state for
--    every existing member and for every new one until they choose to upload.
--    The app treats null as "fall back to initials", so there is no separate
--    "has_avatar" flag to keep in step.
alter table public.members
  add column if not exists avatar_url text;

-- 2. The storage bucket holding the image files.
--
--    public = true, so <img src> works directly with no signed-URL round trip
--    on every render. Paths are unguessable (auth uid folder + random file
--    name), but anyone holding a URL can view that one image — see the note at
--    the foot of this file.
--
--    The size and mime limits are enforced by Storage itself, so a hostile
--    client that skips the app's own client-side resize still cannot park a
--    50MB TIFF here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MiB; the app resizes to ~512px JPEG long before this bites
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 3. Who may do what with those files.
--
--    Every policy is scoped to the first path segment matching the caller's
--    auth uid, i.e. files live at "{auth.uid()}/{random}.jpg". That is what
--    stops one member overwriting or deleting another member's picture, which
--    a bucket-wide "authenticated can write" policy would allow.
--
--    Dropped and recreated rather than guarded with `if not exists` (which
--    `create policy` does not support) so re-running this file always leaves
--    the intended definition in place.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Members can upload their own avatar" on storage.objects;
create policy "Members can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members can replace their own avatar" on storage.objects;
create policy "Members can replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members can delete their own avatar" on storage.objects;
create policy "Members can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Note on privacy: this bucket is public-read, which is the usual trade-off for
-- avatars and what keeps them CDN-cached and instant. The URLs contain a random
-- component so they cannot be enumerated, but they are not behind the app's
-- login. If the group would rather headshots were reachable only by signed-in
-- members, flip `public` to false and switch the app to createSignedUrl() —
-- that costs a round trip per image and loses long-lived caching.
