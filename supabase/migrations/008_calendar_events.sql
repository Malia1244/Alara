-- Personal calendar events (study sessions, reminders, etc.).
-- Test days still live on subjects.test_date; this table is for anything else.
-- Run once in Supabase → SQL Editor → Run.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  event_date date not null,
  notes text not null default '',
  subject_id uuid references public.subjects (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint calendar_events_title_len
    check (char_length(title) between 1 and 120),
  constraint calendar_events_notes_len
    check (char_length(notes) <= 500)
);

create index if not exists calendar_events_user_date_idx
  on public.calendar_events (user_id, event_date);

alter table public.calendar_events enable row level security;
alter table public.calendar_events force row level security;

drop policy if exists calendar_events_select_own on public.calendar_events;
create policy calendar_events_select_own
  on public.calendar_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists calendar_events_insert_own on public.calendar_events;
create policy calendar_events_insert_own
  on public.calendar_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists calendar_events_update_own on public.calendar_events;
create policy calendar_events_update_own
  on public.calendar_events
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists calendar_events_delete_own on public.calendar_events;
create policy calendar_events_delete_own
  on public.calendar_events
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.calendar_events from anon;
grant select, insert, update, delete on table public.calendar_events to authenticated;
