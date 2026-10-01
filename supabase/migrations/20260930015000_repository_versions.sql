-- BATCH 7 (A2): repository_versions is referenced by
-- 20260930020000_repository_files_version.sql but had never been created,
-- so that migration could never apply. This creates it and seeds a version 1
-- row for every existing repository item so the file backfill can resolve.

create table if not exists public.repository_versions (
  id uuid primary key default gen_random_uuid(),
  repository_item_id uuid not null references public.repository_items(id) on delete cascade,
  version_number integer not null default 1 check (version_number >= 1),
  change_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (repository_item_id, version_number)
);

create index if not exists idx_repository_versions_item
  on public.repository_versions(repository_item_id, version_number desc);

alter table public.repository_versions enable row level security;

drop policy if exists repository_versions_read on public.repository_versions;
create policy repository_versions_read on public.repository_versions
  for select to authenticated using (true);

insert into public.repository_versions (repository_item_id, version_number, change_note)
select ri.id, 1, 'Initial deposit version'
from public.repository_items ri
on conflict (repository_item_id, version_number) do nothing;
