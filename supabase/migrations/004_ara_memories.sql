-- Ara's lesson notebook: short memories from Teach Ara (and later sources).
-- Run once in Supabase → SQL Editor → Run.

create table if not exists public.ara_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  subject_id uuid references public.subjects (id) on delete set null,
  topic text not null,
  summary text not null,
  source text not null default 'teach_ara',
  created_at timestamptz not null default now()
);

create index if not exists ara_memories_user_id_idx
  on public.ara_memories (user_id);

create index if not exists ara_memories_user_subject_idx
  on public.ara_memories (user_id, subject);

create index if not exists ara_memories_user_created_idx
  on public.ara_memories (user_id, created_at desc);
