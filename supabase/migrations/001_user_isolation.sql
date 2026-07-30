-- Alara: split all app data by authenticated user.
-- Run this in Supabase → SQL Editor once.

-- Subjects / notes / quizzes
alter table public.subjects
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.daily_learning_entries
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.quizzes
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists subjects_user_id_idx on public.subjects (user_id);
create index if not exists daily_learning_entries_user_id_idx
  on public.daily_learning_entries (user_id);
create index if not exists quizzes_user_id_idx on public.quizzes (user_id);

-- Clear pre-auth shared rows so nobody inherits someone else's data.
delete from public.quizzes where user_id is null;
delete from public.daily_learning_entries where user_id is null;
delete from public.subjects where user_id is null;

-- Shop / points — rebuild around user_id
alter table public.shop_purchases
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.equipped_items
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

delete from public.shop_purchases where user_id is null;
delete from public.equipped_items where user_id is null;

-- Drop old single-profile stats table shape and recreate per-user.
drop table if exists public.user_stats cascade;

create table public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  points integer not null default 0
);

-- Equipped items: one row per (user, slot)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'equipped_items_slot_key'
  ) then
    alter table public.equipped_items drop constraint equipped_items_slot_key;
  end if;
end $$;

alter table public.equipped_items
  drop constraint if exists equipped_items_pkey;

-- Ensure every equipped row has an id if the table uses one; otherwise
-- unique (user_id, slot) is enough for upserts.
create unique index if not exists equipped_items_user_slot_uidx
  on public.equipped_items (user_id, slot);

create unique index if not exists shop_purchases_user_item_uidx
  on public.shop_purchases (user_id, item_id);

-- Optional: require user_id going forward (safe after deletes above)
alter table public.subjects alter column user_id set not null;
alter table public.daily_learning_entries alter column user_id set not null;
alter table public.quizzes alter column user_id set not null;
alter table public.shop_purchases alter column user_id set not null;
alter table public.equipped_items alter column user_id set not null;
