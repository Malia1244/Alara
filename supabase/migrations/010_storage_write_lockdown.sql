-- Defense in depth: keep public read on photo buckets, but block browser
-- clients (anon / authenticated) from upload / update / delete.
-- Uploads go through the FastAPI backend with the service role key.
-- Run once in Supabase → SQL Editor → Run.

-- Lounge assignment photos
drop policy if exists lounge_images_deny_insert on storage.objects;
create policy lounge_images_deny_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'lounge-images' and false);

drop policy if exists lounge_images_deny_update on storage.objects;
create policy lounge_images_deny_update
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'lounge-images' and false);

drop policy if exists lounge_images_deny_delete on storage.objects;
create policy lounge_images_deny_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'lounge-images' and false);

-- Profile photos
drop policy if exists avatars_deny_insert on storage.objects;
create policy avatars_deny_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'avatars' and false);

drop policy if exists avatars_deny_update on storage.objects;
create policy avatars_deny_update
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'avatars' and false);

drop policy if exists avatars_deny_delete on storage.objects;
create policy avatars_deny_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'avatars' and false);
