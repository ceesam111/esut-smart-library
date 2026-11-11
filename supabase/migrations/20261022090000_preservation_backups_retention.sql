-- T10 (Phase 22): backup-status monitoring and non-destructive retention review.
-- preservation_backups records one row per backup-bucket check (count/bytes/latest
-- object or the storage error), retention_policies drives a flag-only review job
-- that marks stale items for librarian attention and never deletes anything.

create table if not exists public.preservation_backups (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  key_prefix text not null default '',
  status text not null check (status in ('ok', 'empty', 'error')),
  object_count integer,
  total_bytes bigint,
  latest_object_at timestamptz,
  error text,
  checked_at timestamptz not null default now()
);

create index if not exists idx_preservation_backups_bucket_checked
  on public.preservation_backups (bucket, checked_at desc);

alter table public.preservation_events drop constraint if exists preservation_events_event_type_check;
alter table public.preservation_events add constraint preservation_events_event_type_check check (
  event_type = any (array[
    'INGESTED'::text,
    'CHECKSUM_CALCULATED'::text,
    'FIXITY_VERIFIED'::text,
    'FIXITY_FAILED'::text,
    'AIP_EXPORTED'::text,
    'AIP_VALIDATED'::text,
    'RESTORED'::text,
    'FILE_REPLACED'::text,
    'INCIDENT_OPENED'::text,
    'INCIDENT_ACKNOWLEDGED'::text,
    'INCIDENT_RESOLVED'::text,
    'RESTORE_STARTED'::text,
    'RESTORE_FAILED'::text,
    'BACKUP_CHECKED'::text,
    'BACKUP_EMPTY'::text,
    'RETENTION_FLAGGED'::text
  ])
);

create table if not exists public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  entity_type text not null default 'repository_item' check (entity_type in ('repository_item')),
  older_than_years integer not null check (older_than_years > 0),
  statuses text[] not null default array['published']::text[],
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.retention_policies (name, entity_type, older_than_years, statuses)
select 'Flag published repository items older than 7 years for retention review', 'repository_item', 7, array['published']::text[]
where not exists (
  select 1 from public.retention_policies
  where name = 'Flag published repository items older than 7 years for retention review'
);

alter table public.repository_items add column if not exists retention_reviewed_at timestamptz;

alter table public.preservation_backups enable row level security;
alter table public.retention_policies enable row level security;

drop policy if exists backups_admin_read on public.preservation_backups;
create policy backups_admin_read on public.preservation_backups
  for select using (public.is_library_admin(auth.uid()));

drop policy if exists retention_policies_admin_read on public.retention_policies;
create policy retention_policies_admin_read on public.retention_policies
  for select using (public.is_library_admin(auth.uid()));

insert into public.agent_schedules (label, job_type, agent_name, payload, priority, enabled, interval_minutes, next_run_at)
select 'Daily backup status check', 'preservation.backupMonitor', 'Norma', '{}'::jsonb, 5, true, 1440, now() + interval '4 hours'
where not exists (
  select 1 from public.agent_schedules where job_type = 'preservation.backupMonitor'
);

insert into public.agent_schedules (label, job_type, agent_name, payload, priority, enabled, interval_minutes, next_run_at)
select 'Weekly retention review', 'preservation.retentionReview', 'Norma', '{}'::jsonb, 5, true, 10080, now() + interval '6 hours'
where not exists (
  select 1 from public.agent_schedules where job_type = 'preservation.retentionReview'
);

select label, job_type, enabled, interval_minutes
from public.agent_schedules
where job_type in ('preservation.backupMonitor', 'preservation.retentionReview');
