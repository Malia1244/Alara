-- Alara: enable Row Level Security on all app tables.
-- Fixes Supabase "rls_disabled_in_public" / publicly accessible tables.
--
-- Safe with the current architecture: the FastAPI backend uses the
-- service_role key, which bypasses RLS. The browser only uses the anon key
-- for auth — these policies block open read/write of user data via the URL.
--
-- Run once in Supabase → SQL Editor → Run.

-- Helper: enable RLS + standard per-user CRUD for a user_id table.
-- Policies are dropped/recreated so this migration is re-runnable.

do $$
declare
  t text;
  tables text[] := array[
    'subjects',
    'daily_learning_entries',
    'quizzes',
    'shop_purchases',
    'equipped_items',
    'user_stats',
    'ara_memories'
  ];
begin
  foreach t in array tables
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    -- Force RLS even for table owners in the API roles path.
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      t || '_select_own', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      t || '_insert_own', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      t || '_delete_own', t
    );
  end loop;
end $$;

-- Revoke wide-open privileges from anon (browser key without a user session).
-- Authenticated keeps table access, but RLS policies above still filter rows.
do $$
declare
  t text;
  tables text[] := array[
    'subjects',
    'daily_learning_entries',
    'quizzes',
    'shop_purchases',
    'equipped_items',
    'user_stats',
    'ara_memories'
  ];
begin
  foreach t in array tables
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('revoke all on table public.%I from anon', t);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      t
    );
  end loop;
end $$;
