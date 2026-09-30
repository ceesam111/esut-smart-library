-- Add repository_version_id to repository_files for version-aware file tracking
alter table public.repository_files
  add column if not exists repository_version_id uuid null;

create index if not exists idx_repository_files_version on public.repository_files(repository_version_id);

-- Assign existing files to the latest version of their item
update public.repository_files rf
set repository_version_id = (
  select rv.id
  from public.repository_versions rv
  where rv.repository_item_id = rf.repository_item_id
  order by rv.version_number desc
  limit 1
)
where rf.repository_version_id is null
  and exists (
    select 1 from public.repository_versions rv where rv.repository_item_id = rf.repository_item_id
  );
