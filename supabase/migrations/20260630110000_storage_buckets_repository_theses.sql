insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('repository', 'repository', true, 104857600, array['application/pdf']),
  ('theses', 'theses', true, 104857600, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists repository_objects_authenticated_upload on storage.objects;
create policy repository_objects_authenticated_upload on storage.objects for insert to authenticated
  with check (bucket_id in ('repository', 'theses'));

drop policy if exists repository_objects_authenticated_read on storage.objects;
create policy repository_objects_authenticated_read on storage.objects for select to authenticated
  using (bucket_id in ('repository', 'theses'));

drop policy if exists repository_objects_owner_update on storage.objects;
create policy repository_objects_owner_update on storage.objects for update to authenticated
  using (bucket_id in ('repository', 'theses') and owner = auth.uid())
  with check (bucket_id in ('repository', 'theses') and owner = auth.uid());

drop policy if exists repository_objects_owner_delete on storage.objects;
create policy repository_objects_owner_delete on storage.objects for delete to authenticated
  using (bucket_id in ('repository', 'theses') and owner = auth.uid());
