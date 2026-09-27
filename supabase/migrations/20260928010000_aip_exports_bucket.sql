-- WAVE 2: AIP exports storage bucket
insert into storage.buckets (id, name, public)
values ('aip-exports', 'aip-exports', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aip_exports_read') then
    create policy "aip_exports_read" on storage.objects for select using (bucket_id = 'aip-exports');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aip_exports_insert') then
    create policy "aip_exports_insert" on storage.objects for insert with check (bucket_id = 'aip-exports');
  end if;
end $$;
