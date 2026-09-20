-- Shared Lounge: one chat room every signed-in student can read and write.
-- Run once in Supabase → SQL Editor → Run.
--
-- room_id is "lounge" for everyone today. Later, class rooms can use
-- other ids (for example class-<uuid>) without changing this table.

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  room_id text not null default 'lounge',
  author_label text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint community_messages_body_len
    check (char_length(body) between 1 and 500),
  constraint community_messages_room_len
    check (char_length(room_id) between 1 and 64),
  constraint community_messages_label_len
    check (char_length(author_label) between 1 and 32)
);

create index if not exists community_messages_room_created_idx
  on public.community_messages (room_id, created_at desc);

alter table public.community_messages enable row level security;
alter table public.community_messages force row level security;

drop policy if exists community_messages_select_signed_in
  on public.community_messages;
create policy community_messages_select_signed_in
  on public.community_messages
  for select
  to authenticated
  using (true);

drop policy if exists community_messages_insert_own
  on public.community_messages;
create policy community_messages_insert_own
  on public.community_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists community_messages_delete_own
  on public.community_messages;
create policy community_messages_delete_own
  on public.community_messages
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.community_messages from anon;
grant select, insert, delete on table public.community_messages to authenticated;
