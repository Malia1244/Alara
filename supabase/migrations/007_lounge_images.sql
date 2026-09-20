-- Lounge photos + replies: assignment help from other students.
-- Run once in Supabase → SQL Editor → Run (after 006_community_messages.sql).
--
-- Adds:
--   image_path  — photo stored in the lounge-images bucket
--   reply_to_id — answer a specific question/post
--   public storage bucket for those photos

alter table public.community_messages
  drop constraint if exists community_messages_body_len;

alter table public.community_messages
  alter column body set default '';

alter table public.community_messages
  add column if not exists image_path text;

alter table public.community_messages
  add column if not exists reply_to_id uuid
    references public.community_messages (id) on delete set null;

alter table public.community_messages
  drop constraint if exists community_messages_has_content;

alter table public.community_messages
  add constraint community_messages_has_content
  check (
    char_length(body) <= 500
    and (
      length(trim(body)) > 0
      or image_path is not null
    )
  );

create index if not exists community_messages_reply_to_idx
  on public.community_messages (reply_to_id);

insert into storage.buckets (id, name, public)
values ('lounge-images', 'lounge-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists lounge_images_public_read on storage.objects;
create policy lounge_images_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'lounge-images');
