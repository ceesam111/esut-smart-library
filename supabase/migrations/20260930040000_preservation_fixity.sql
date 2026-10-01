-- BATCH 7: Preservation, fixity, and real AIP
-- EDITED BEFORE FIRST APPLICATION: the original version of this file was
-- never applied anywhere, so it is extended here to the shape Batch 7
-- actually needs instead of adding a follow-up migration that would fight it.
--
-- Changes from the original draft:
--   * preservation_events gains repository_item_id (AIP/restore events are
--     item-scoped) and a nullable repository_file_id, plus the two missing
--     event types AIP_VALIDATED and FILE_REPLACED.
--   * preservation_incidents gains an acknowledge/resolve audit trail.
--   * preservation_incident_events records every state change.
--   * restore_runs holds restore attempts against an isolated target.

alter table public.repository_files
  add column if not exists last_verified_at timestamptz,
  add column if not exists next_verification_at timestamptz,
  add column if not exists last_verification_result text,
  add column if not exists observed_checksum text;

create table if not exists public.preservation_events (
  id uuid primary key default gen_random_uuid(),
  repository_file_id uuid references public.repository_files(id) on delete cascade,
  repository_item_id uuid references public.repository_items(id) on delete cascade,
  event_type text not null check (event_type in (
    'INGESTED', 'CHECKSUM_CALCULATED', 'FIXITY_VERIFIED', 'FIXITY_FAILED',
    'AIP_EXPORTED', 'AIP_VALIDATED', 'RESTORED', 'FILE_REPLACED'
  )),
  details jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (repository_file_id is not null or repository_item_id is not null)
);

create table if not exists public.preservation_incidents (
  id uuid primary key default gen_random_uuid(),
  repository_file_id uuid not null references public.repository_files(id) on delete cascade,
  incident_type text not null check (incident_type in ('MISMATCH', 'MISSING', 'ERROR')),
  expected_checksum text,
  observed_checksum text,
  details jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.preservation_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.preservation_incidents(id) on delete cascade,
  action text not null check (action in ('opened', 'acknowledged', 'resolved', 'reopened')),
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.restore_runs (
  id uuid primary key default gen_random_uuid(),
  aip_path text not null,
  repository_item_id uuid references public.repository_items(id) on delete set null,
  target text not null default 'isolated' check (target in ('test', 'staging', 'isolated')),
  status text not null default 'running' check (status in ('running', 'validated', 'failed', 'applied')),
  restored_document jsonb,
  differences jsonb,
  file_count integer not null default 0,
  error text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Convergence guards. `create table if not exists` above is skipped when an
-- earlier fixity migration already created these tables in an older shape, so
-- every Batch 7 addition is repeated here as an idempotent alter. Without this
-- a partially-provisioned database keeps its old columns and the indexes below
-- fail with "column does not exist".
alter table public.preservation_events
  add column if not exists repository_item_id uuid references public.repository_items(id) on delete cascade,
  alter column repository_file_id drop not null;

alter table public.preservation_events drop constraint if exists preservation_events_check;
alter table public.preservation_events add constraint preservation_events_check
  check (repository_file_id is not null or repository_item_id is not null);

alter table public.preservation_incidents
  add column if not exists acknowledged_by uuid references auth.users(id) on delete set null,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolution_note text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_preservation_events_file on public.preservation_events(repository_file_id, created_at desc);
create index if not exists idx_preservation_events_item on public.preservation_events(repository_item_id, created_at desc);
create index if not exists idx_preservation_events_type on public.preservation_events(event_type, created_at desc);
create index if not exists idx_preservation_incidents_file on public.preservation_incidents(repository_file_id);
create index if not exists idx_preservation_incidents_status on public.preservation_incidents(status, created_at desc);
create index if not exists idx_preservation_incident_events_incident on public.preservation_incident_events(incident_id, created_at);
create index if not exists idx_restore_runs_item on public.restore_runs(repository_item_id);
create index if not exists idx_repository_files_due on public.repository_files(next_verification_at)
  where next_verification_at is not null and preservation_status = 'active';

alter table public.preservation_events enable row level security;
alter table public.preservation_incidents enable row level security;
alter table public.preservation_incident_events enable row level security;
alter table public.restore_runs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='preservation_events' and policyname='preservation_service_all') then
    create policy "preservation_service_all" on public.preservation_events for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='preservation_events' and policyname='preservation_events_admin_read') then
    create policy "preservation_events_admin_read" on public.preservation_events for select to authenticated
      using (public.is_library_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='preservation_incidents' and policyname='preservation_incidents_service_all') then
    create policy "preservation_incidents_service_all" on public.preservation_incidents for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='preservation_incidents' and policyname='preservation_incidents_admin_read') then
    create policy "preservation_incidents_admin_read" on public.preservation_incidents for select to authenticated
      using (public.is_library_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='preservation_incident_events' and policyname='preservation_incident_events_service_all') then
    create policy "preservation_incident_events_service_all" on public.preservation_incident_events for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='preservation_incident_events' and policyname='preservation_incident_events_admin_read') then
    create policy "preservation_incident_events_admin_read" on public.preservation_incident_events for select to authenticated
      using (public.is_library_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='restore_runs' and policyname='restore_runs_service_all') then
    create policy "restore_runs_service_all" on public.restore_runs for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restore_runs' and policyname='restore_runs_admin_read') then
    create policy "restore_runs_admin_read" on public.restore_runs for select to authenticated
      using (public.is_library_admin(auth.uid()));
  end if;
end $$;

-- Scheduled producer: marks due files and enqueues bounded per-file fixity
-- jobs. Cadence/batch size live in payload so operators can tune them without
-- a redeploy.
insert into public.agent_schedules (label, agent_name, job_type, payload, priority, enabled, interval_minutes, next_run_at)
select
  'Preservation fixity producer',
  'preservation',
  'preservation.fixityProducer',
  jsonb_build_object('batchSize', 50, 'cadenceDays', 7),
  5, true, 1440, now()
where not exists (
  select 1 from public.agent_schedules where job_type = 'preservation.fixityProducer'
);
