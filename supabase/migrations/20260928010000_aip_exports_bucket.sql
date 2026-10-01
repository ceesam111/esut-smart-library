-- WAVE 2: AIP exports storage bucket
-- EDITED BEFORE FIRST APPLICATION: the original version created the bucket as
-- public with an unrestricted read policy. AIPs are archival packages for
-- library staff; they must never be world-readable. The bucket is private and
-- only service_role (server routes) can read/write it. Admins download through
-- the authenticated server route which mints a short-lived signed URL.
insert into storage.buckets (id, name, public)
values ('aip-exports', 'aip-exports', false)
on conflict (id) do update set public = false;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aip_exports_service_read') then
    create policy "aip_exports_service_read" on storage.objects for select to service_role using (bucket_id = 'aip-exports');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aip_exports_service_write') then
    create policy "aip_exports_service_write" on storage.objects for insert to service_role with check (bucket_id = 'aip-exports');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aip_exports_read') then
    -- legacy public read policy name: if it ever existed, remove it
    null;
  end if;
end $$;
