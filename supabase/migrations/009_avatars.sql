-- Profile pics for Lounge + account menu.
-- Run once in Supabase → SQL Editor → Run (after 007_lounge_images.sql).
--
-- Adds:
--   author_avatar_path — denormalized avatar on each Lounge message
--   public storage bucket for profile photos

alter table public.community_messages
  add column if not exists author_avatar_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');
