-- shop_purchases still had a global primary key on item_id alone, so only
-- one account in the whole database could own each item (e.g. Classic Pigtails).
-- Run once in Supabase → SQL Editor.

-- Drop legacy single-column uniqueness on item_id
alter table public.shop_purchases drop constraint if exists shop_purchases_pkey;
alter table public.shop_purchases drop constraint if exists shop_purchases_item_id_key;
drop index if exists shop_purchases_item_id_key;
drop index if exists shop_purchases_pkey;

-- Prefer a surrogate id if the table already has one; otherwise add it.
alter table public.shop_purchases
  add column if not exists id bigserial;

-- Deduplicate any accidental (user_id, item_id) pairs before unique index
delete from public.shop_purchases a
using public.shop_purchases b
where a.ctid < b.ctid
  and a.user_id = b.user_id
  and a.item_id = b.item_id;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'shop_purchases'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.shop_purchases
      add constraint shop_purchases_pkey primary key (id);
  end if;
end $$;

create unique index if not exists shop_purchases_user_item_uidx
  on public.shop_purchases (user_id, item_id);
