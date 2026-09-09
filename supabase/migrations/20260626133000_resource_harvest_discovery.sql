-- Open-access resource harvesting and search-triggered discovery.

alter table if exists public.catalogue_items
  add column if not exists doi text null,
  add column if not exists item_type text null,
  add column if not exists status text not null default 'available',
  add column if not exists source_name text null,
  add column if not exists source_record_id text null,
  add column if not exists source_url text null,
  add column if not exists licence text null,
  add column if not exists rights_status text null,
  add column if not exists b2_object_key text null,
  add column if not exists external_sources jsonb not null default '[]'::jsonb,
  add column if not exists metadata_quality_score integer null,
  add column if not exists last_external_checked_at timestamptz null,
  add column if not exists refresh_after timestamptz null;

alter table if exists public.resource_requests
  add column if not exists resource_candidate_id uuid null,
  add column if not exists tenant_id uuid not null default public.default_tenant_id();

create table if not exists public.resource_harvest_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  name text not null,
  source_type text not null,
  enabled boolean not null default true,
  query_config jsonb not null default '{}'::jsonb,
  schedule text null,
  last_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.resource_harvest_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  source_id uuid null references public.resource_harvest_sources(id) on delete set null,
  job_name text not null,
  trigger_type text not null default 'scheduled' check (trigger_type in ('scheduled', 'manual_admin', 'search_miss', 'search_weak_results')),
  search_query text null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  total_found integer not null default 0,
  staged_count integer not null default 0,
  auto_added_count integer not null default 0,
  skipped_duplicates integer not null default 0,
  downloaded_count integer not null default 0,
  error_count integer not null default 0,
  error text null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.resource_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  harvest_run_id uuid null references public.resource_harvest_runs(id) on delete set null,
  source_name text not null,
  source_record_id text null,
  discovery_source text not null default 'harvest' check (discovery_source in ('harvest', 'search_discovery', 'barcode_lookup', 'csv_enrichment')),
  search_query text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'auto_added', 'duplicate', 'needs_review', 'error')),
  confidence text not null default 'needs_review' check (confidence in ('clean_match', 'needs_review', 'no_match', 'conflict')),
  title text null,
  authors text[] not null default '{}',
  publisher text null,
  year integer null,
  language text null,
  subjects text[] not null default '{}',
  description text null,
  isbn text null,
  issn text null,
  doi text null,
  item_type text null,
  licence text null,
  rights_status text null,
  source_url text null,
  download_url text null,
  cover_url text null,
  b2_object_key text null,
  raw_metadata jsonb not null default '{}'::jsonb,
  duplicate_of uuid null references public.resource_candidates(id) on delete set null,
  promoted_catalogue_item_id uuid null references public.catalogue_items(id) on delete set null,
  requested_count integer not null default 0,
  last_external_checked_at timestamptz null,
  external_sources jsonb not null default '[]'::jsonb,
  metadata_quality_score integer null,
  refresh_after timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'resource_requests') then
    alter table public.resource_requests
      add constraint resource_requests_resource_candidate_fk
      foreign key (resource_candidate_id) references public.resource_candidates(id) on delete set null;
  end if;
exception when duplicate_object then null;
end $$;

create table if not exists public.resource_discovery_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  user_id uuid null references auth.users(id) on delete set null,
  search_query text not null,
  local_result_count integer not null default 0,
  local_result_quality text null check (local_result_quality in ('good', 'weak', 'none')),
  external_lookup_triggered boolean not null default false,
  sources_queried text[] not null default '{}',
  external_result_count integer not null default 0,
  staged_count integer not null default 0,
  auto_added_count integer not null default 0,
  duplicate_count integer not null default 0,
  error text null,
  created_at timestamptz not null default now()
);

drop trigger if exists resource_harvest_sources_touch_updated_at on public.resource_harvest_sources;
create trigger resource_harvest_sources_touch_updated_at before update on public.resource_harvest_sources
  for each row execute function public.touch_updated_at();

drop trigger if exists resource_candidates_touch_updated_at on public.resource_candidates;
create trigger resource_candidates_touch_updated_at before update on public.resource_candidates
  for each row execute function public.touch_updated_at();

create index if not exists idx_resource_harvest_sources_tenant_id on public.resource_harvest_sources(tenant_id);
create index if not exists idx_resource_harvest_sources_enabled on public.resource_harvest_sources(enabled);
create index if not exists idx_resource_harvest_sources_type on public.resource_harvest_sources(source_type);

create index if not exists idx_resource_harvest_runs_tenant_id on public.resource_harvest_runs(tenant_id);
create index if not exists idx_resource_harvest_runs_source_id on public.resource_harvest_runs(source_id);
create index if not exists idx_resource_harvest_runs_trigger_type on public.resource_harvest_runs(trigger_type);
create index if not exists idx_resource_harvest_runs_status on public.resource_harvest_runs(status);
create index if not exists idx_resource_harvest_runs_started_at on public.resource_harvest_runs(started_at desc);
create index if not exists idx_resource_harvest_runs_search_query on public.resource_harvest_runs(search_query);

create index if not exists idx_resource_candidates_tenant_id on public.resource_candidates(tenant_id);
create index if not exists idx_resource_candidates_status on public.resource_candidates(status);
create index if not exists idx_resource_candidates_confidence on public.resource_candidates(confidence);
create index if not exists idx_resource_candidates_source_record on public.resource_candidates(source_name, source_record_id);
create index if not exists idx_resource_candidates_discovery_source on public.resource_candidates(discovery_source);
create index if not exists idx_resource_candidates_search_query on public.resource_candidates(search_query);
create index if not exists idx_resource_candidates_isbn on public.resource_candidates(isbn);
create index if not exists idx_resource_candidates_issn on public.resource_candidates(issn);
create index if not exists idx_resource_candidates_doi on public.resource_candidates(doi);
create index if not exists idx_resource_candidates_title on public.resource_candidates(title);
create index if not exists idx_resource_candidates_created_at on public.resource_candidates(created_at desc);
create index if not exists idx_resource_candidates_duplicate_of on public.resource_candidates(duplicate_of);
create index if not exists idx_resource_candidates_tenant_status_confidence on public.resource_candidates(tenant_id, status, confidence);

create index if not exists idx_resource_discovery_logs_tenant_query_created on public.resource_discovery_logs(tenant_id, search_query, created_at desc);
create index if not exists idx_resource_discovery_logs_tenant_created on public.resource_discovery_logs(tenant_id, created_at desc);

create index if not exists idx_catalogue_items_tenant_doi on public.catalogue_items(tenant_id, doi) where doi is not null;
create index if not exists idx_catalogue_items_source_record on public.catalogue_items(tenant_id, source_name, source_record_id) where source_name is not null;
create index if not exists idx_catalogue_items_refresh_after on public.catalogue_items(refresh_after) where refresh_after is not null;

alter table public.resource_harvest_sources enable row level security;
alter table public.resource_harvest_runs enable row level security;
alter table public.resource_candidates enable row level security;
alter table public.resource_discovery_logs enable row level security;

drop policy if exists resource_harvest_sources_admin_read on public.resource_harvest_sources;
create policy resource_harvest_sources_admin_read on public.resource_harvest_sources for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists resource_harvest_runs_admin_read on public.resource_harvest_runs;
create policy resource_harvest_runs_admin_read on public.resource_harvest_runs for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists resource_candidates_admin_read on public.resource_candidates;
create policy resource_candidates_admin_read on public.resource_candidates for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists resource_candidates_admin_update on public.resource_candidates;
create policy resource_candidates_admin_update on public.resource_candidates for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()))
  with check (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists resource_discovery_logs_admin_read on public.resource_discovery_logs;
create policy resource_discovery_logs_admin_read on public.resource_discovery_logs for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

grant select on public.resource_harvest_sources, public.resource_harvest_runs, public.resource_candidates, public.resource_discovery_logs to authenticated;
grant update on public.resource_candidates to authenticated;
grant all on public.resource_harvest_sources, public.resource_harvest_runs, public.resource_candidates, public.resource_discovery_logs to service_role;
