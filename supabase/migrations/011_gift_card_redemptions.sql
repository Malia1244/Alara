-- Gift card redemptions: spend shop points, then fulfill manually.
-- Run once in Supabase → SQL Editor → Run.
--
-- Students redeem in the Shop. Check this table for pending claims
-- (status = 'pending') and mark them 'fulfilled' after you send the card.

create table if not exists public.gift_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  offer_id text not null,
  amount_usd integer not null check (amount_usd > 0),
  points_spent integer not null check (points_spent > 0),
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  notes text
);

create index if not exists gift_card_redemptions_user_created_idx
  on public.gift_card_redemptions (user_id, created_at desc);

create index if not exists gift_card_redemptions_status_idx
  on public.gift_card_redemptions (status, created_at desc);

alter table public.gift_card_redemptions enable row level security;
alter table public.gift_card_redemptions force row level security;

drop policy if exists gift_card_redemptions_select_own
  on public.gift_card_redemptions;
create policy gift_card_redemptions_select_own
  on public.gift_card_redemptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserts/updates go through the API (service role). No client writes.
revoke all on table public.gift_card_redemptions from anon;
revoke all on table public.gift_card_redemptions from authenticated;
grant select on table public.gift_card_redemptions to authenticated;
