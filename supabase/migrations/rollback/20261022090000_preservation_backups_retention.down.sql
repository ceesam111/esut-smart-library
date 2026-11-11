-- Reverts 20261022090000_preservation_backups_retention.sql (Phase 22 / T10).
-- Restores the Batch 7 preservation event vocabulary verbatim (20260930080000:12-28).

delete from public.agent_schedules
where job_type in ('preservation.backupMonitor', 'preservation.retentionReview');

drop policy if exists retention_policies_admin_read on public.retention_policies;
drop policy if exists backups_admin_read on public.preservation_backups;

alter table if exists public.repository_items drop column if exists retention_reviewed_at;

drop table if exists public.retention_policies;
drop table if exists public.preservation_backups;

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
    'RESTORE_FAILED'::text
  ])
);
