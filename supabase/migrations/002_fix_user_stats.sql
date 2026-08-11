-- Finish auth isolation that migration 001 only partly applied.
-- Run once in Supabase → SQL Editor → Run.

-- 1) Ensure user_id columns exist on shop tables
alter table public.shop_purchases
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.equipped_items
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- 2) Rebuild user_stats around user_id (keep old points if present)
do $$
declare
  old_points integer := 0;
  only_user uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_stats'
      and column_name = 'points'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_stats'
      and column_name = 'user_id'
  ) then
    select coalesce(points, 0) into old_points from public.user_stats limit 1;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_stats'
      and column_name = 'user_id'
  ) then
    -- already new shape; nothing to migrate in this block
    return;
  end if;

  select id into only_user from auth.users order by created_at asc limit 1;

  drop table if exists public.user_stats cascade;

  create table public.user_stats (
    user_id uuid primary key references auth.users (id) on delete cascade,
    points integer not null default 0
  );

  if only_user is not null then
    insert into public.user_stats (user_id, points)
    values (only_user, coalesce(old_points, 0));
  end if;
end $$;

-- 3) Claim orphan rows for the first auth user
update public.subjects s
set user_id = u.id
from (select id from auth.users order by created_at asc limit 1) u
where s.user_id is null;

update public.daily_learning_entries e
set user_id = u.id
from (select id from auth.users order by created_at asc limit 1) u
where e.user_id is null;

update public.quizzes q
set user_id = u.id
from (select id from auth.users order by created_at asc limit 1) u
where q.user_id is null;

update public.shop_purchases sp
set user_id = u.id
from (select id from auth.users order by created_at asc limit 1) u
where sp.user_id is null;

update public.equipped_items ei
set user_id = u.id
from (select id from auth.users order by created_at asc limit 1) u
where ei.user_id is null;

-- 4) Indexes / constraints used by the app
create unique index if not exists equipped_items_user_slot_uidx
  on public.equipped_items (user_id, slot);

create unique index if not exists shop_purchases_user_item_uidx
  on public.shop_purchases (user_id, item_id);
