-- BATCH 5: Repository multi-file/bitstream architecture
create table if not exists public.repository_files (
  id uuid primary key default gen_random_uuid(),
  repository_item_id uuid not null references public.repository_items(id) on delete cascade,
  storage_provider text not null default 'supabase',
  storage_bucket text not null,
  storage_key text not null,
  original_filename text not null,
  display_filename text,
  mime_type text,
  file_size bigint,
  checksum text,
  checksum_algorithm text not null default 'sha256',
  description text,
  role text not null default 'ORIGINAL' check (role in ('ORIGINAL', 'SUPPLEMENTARY', 'THUMBNAIL', 'TEXT', 'LICENSE', 'METADATA')),
  display_order int not null default 0,
  access_level text not null default 'PUBLIC' check (access_level in ('PUBLIC', 'AUTHENTICATED', 'FACULTY', 'RESTRICTED', 'PRIVATE')),
  embargo_until timestamptz,
  uploader_id uuid references auth.users(id) on delete set null,
  preservation_status text not null default 'active',
  extracted_text_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(repository_item_id, storage_key)
);

create index if not exists idx_repository_files_item on public.repository_files(repository_item_id);
create index if not exists idx_repository_files_role on public.repository_files(repository_item_id, role);
create index if not exists idx_repository_files_access on public.repository_files(access_level);

alter table public.repository_files enable row level security;

drop policy if exists repository_files_read on public.repository_files;
create policy repository_files_read on public.repository_files for select to authenticated
  using (
    access_level = 'PUBLIC'
    or access_level = 'AUTHENTICATED'
    or uploader_id = auth.uid()
    or public.is_library_admin(auth.uid())
  );

drop policy if exists repository_files_insert on public.repository_files;
create policy repository_files_insert on public.repository_files for insert to authenticated
  with check (uploader_id = auth.uid() or public.is_library_admin(auth.uid()));

drop policy if exists repository_files_update on public.repository_files;
create policy repository_files_update on public.repository_files for update to authenticated
  using (uploader_id = auth.uid() or public.is_library_admin(auth.uid()));

drop policy if exists repository_files_delete on public.repository_files;
create policy repository_files_delete on public.repository_files for delete to authenticated
  using (uploader_id = auth.uid() or public.is_library_admin(auth.uid()));

-- Backfill existing file_url values into repository_files
insert into public.repository_files (repository_item_id, storage_bucket, storage_key, original_filename, role, access_level, uploader_id)
select
  ri.id,
  'repository',
  ri.file_url,
  split_part(ri.file_url, '/', -1),
  'ORIGINAL',
  case ri.visibility
    when 'global' then 'PUBLIC'
    when 'faculty' then 'FACULTIC'
    else 'PRIVATE'
  end,
  ri.submitter_id
from public.repository_items ri
where ri.file_url is not null
  and not exists (
    select 1 from public.repository_files rf where rf.repository_item_id = ri.id and rf.storage_key = ri.file_url
  );
