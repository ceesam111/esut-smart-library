-- Batch 7: preservation/fixity/AIP completion schema convergence.
-- Verified against production project rnnjspkdhojoigncdgmy on 2026-09-30.
-- Adds the remaining preservation columns/constraints the Batch 7 services require.

-- 1) When was the expected checksum originally calculated?
ALTER TABLE public.repository_files
  ADD COLUMN IF NOT EXISTS checksum_calculated_at timestamptz;

-- 2) Preservation event vocabulary must cover fixity, AIP validation,
--    incident lifecycle and restore lifecycle (B10, B14, B20).
ALTER TABLE public.preservation_events DROP CONSTRAINT IF EXISTS preservation_events_event_type_check;
ALTER TABLE public.preservation_events ADD CONSTRAINT preservation_events_event_type_check CHECK (
  event_type = ANY (ARRAY[
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

-- 3) restore_runs lifecycle (B14). Legacy values stay valid.
ALTER TABLE public.restore_runs DROP CONSTRAINT IF EXISTS restore_runs_status_check;
ALTER TABLE public.restore_runs ADD CONSTRAINT restore_runs_status_check CHECK (
  status = ANY (ARRAY[
    'pending'::text,
    'running'::text,
    'validated'::text,
    'complete'::text,
    'failed'::text,
    'applied'::text
  ])
);

-- 4) Incident lookup by file for dashboards/audits (B5, B6).
CREATE INDEX IF NOT EXISTS idx_preservation_incidents_created_at
  ON public.preservation_incidents (created_at DESC);

-- 5) Restore runs are always scoped to a tenant-usable item lookup.
CREATE INDEX IF NOT EXISTS idx_restore_runs_status
  ON public.restore_runs (status, created_at DESC);
