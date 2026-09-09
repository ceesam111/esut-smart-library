-- Backblaze B2 object metadata for large/long-term Smart Library files.

create table if not exists public.library_objects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  bucket text not null,
  object_key text not null,
  original_filename text,
  content_type text,
  size_bytes bigint,
  checksum text null,
  visibility text not null default 'private' check (visibility in ('private', 'tenant', 'public')),
  linked_entity_type text null,
  linked_entity_id uuid null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(bucket, object_key)
);

create index if not exists idx_library_objects_tenant_id on public.library_objects(tenant_id);
create index if not exists idx_library_objects_bucket_key on public.library_objects(bucket, object_key);
create index if not exists idx_library_objects_linked_entity on public.library_objects(tenant_id, linked_entity_type, linked_entity_id);
create index if not exists idx_library_objects_uploaded_by on public.library_objects(uploaded_by);
create index if not exists idx_library_objects_created_at on public.library_objects(created_at desc);
create index if not exists idx_library_objects_visibility on public.library_objects(visibility);

alter table public.library_objects enable row level security;

drop policy if exists library_objects_tenant_read on public.library_objects;
create policy library_objects_tenant_read
  on public.library_objects for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      visibility in ('tenant', 'public')
      or uploaded_by = auth.uid()
      or public.is_library_admin(auth.uid())
    )
  );

drop policy if exists library_objects_public_read on public.library_objects;
create policy library_objects_public_read
  on public.library_objects for select to anon
  using (visibility = 'public');

drop policy if exists library_objects_admin_update on public.library_objects;
create policy library_objects_admin_update
  on public.library_objects for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()))
  with check (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists library_objects_admin_delete on public.library_objects;
create policy library_objects_admin_delete
  on public.library_objects for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

grant select on public.library_objects to anon, authenticated;
grant update, delete on public.library_objects to authenticated;
grant all on public.library_objects to service_role;
