-- Make repository and theses buckets private
update storage.buckets set public = false where id in ('repository', 'theses');

drop policy if exists repository_objects_authenticated_read on storage.objects;
create policy repository_objects_authenticated_read on storage.objects for select to authenticated
  using (bucket_id in ('repository', 'theses') and owner = auth.uid());

drop policy if exists repository_objects_anon_read on storage.objects;
create policy repository_objects_anon_read on storage.objects for select to anon
  using (false);
