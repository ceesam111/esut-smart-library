# Preservation, Fixity and AIP — Operator Guide

Batch 7 added the preservation subsystem: periodic fixity verification, incident
management, BagIt AIP export/validation and isolated restore. This document is
the operator reference. Source of truth for behaviour is
`src/server/preservation/*`.

## Concepts

| Term | Meaning |
|---|---|
| Fixity | Re-hashing a stored object and comparing it to the checksum recorded at ingest. |
| Cadence | How often a file is re-verified. Default 7 days, configurable per file. |
| Expected checksum | The `repository_files.checksum` value captured at ingest. **Never overwritten** by verification. |
| Observed checksum | The checksum computed from the bytes actually read during verification. |
| Incident | An open record of a MISMATCH or MISSING result, with an audit trail. |
| AIP | Archival Information Package — a BagIt-1.0 bundle of an item's payloads and metadata. |
| Restore | Materialising an AIP back into the repository as a new, isolated item. |

## Fixity state machine

`classifyFixity()` in `src/server/preservation/fixity.ts` is the single decision
point. It is pure and unit-tested.

| State | Meaning | Opens an incident? |
|---|---|---|
| `VALID` | Observed checksum equals the expected checksum. | No |
| `MISMATCH` | Object read successfully, checksum differs. | Yes |
| `MISSING` | Object could not be read (404/400/403, deleted, bucket absent). | Yes |
| `ERROR` | Verification could not run (unsupported algorithm, inactive provider, read failure). | No |
| `PENDING` | Not yet verified. | No |

`ERROR` is deliberately **not** corruption: it means the check could not be
performed, so no conclusion about the bytes may be drawn. Only `MISMATCH` and
`MISSING` open incidents.

## Where fixity state lives

Fixity state is stored on `repository_files.last_verification_result`, with
`observed_checksum`, `last_verification_at` and `next_verification_at` alongside
it. `preservation_status` remains the object lifecycle flag (`active`) so the
partial index `idx_repository_files_due` keeps selecting due files.

## Scheduling and dedupe

- The producer (`preservation.fixityProducer`, every 1440 min) enqueues **at most
  one** pending/running `preservation.verifyFixity` job. A second call while one is
  pending returns `deduped: true` with the existing job id.
- The verifier re-queries due files at execution time and stamps
  `next_verification_at = now + cadenceDays` **before** hashing. This claims the
  file for the cadence window, so a crash mid-verification does not lose the file
  from the next run.
- Manual recheck = `markFileDue` + `ensureVerifyJobQueued`, exposed as
  `POST /api/preservation/files`.

## Storage reads are cache-busting

Supabase Storage serves `/object/` with `cache-control: public, max-age=3600`.
A plain `download()` therefore returns stale bytes for up to an hour after an
overwrite or delete, which would make fixity report a false `VALID`.

`supabaseStore().read` in `src/server/preservation/objectStore.ts` issues a
short-lived signed URL and fetches it with `cache: 'no-store'`. Signed URLs are
not CDN-cached and return `400 Object not found` for absent objects, which the
store maps to `status: 'missing'`.

**Consequence:** any new code that reads repository objects for a correctness
decision must use `readStoredObject`, not `storage.from(...).download()`.

## Incidents

`src/server/preservation/incidents.ts` enforces the lifecycle
`open → acknowledged → resolved`. Every transition writes a row to
`preservation_incident_events` and a `preservation_events` entry
(`INCIDENT_OPENED`, `INCIDENT_ACKNOWLEDGED`, `INCIDENT_RESOLVED`).

A new incident for the same file and type is only opened when no non-resolved
incident of that type exists, so a persistently corrupt file produces one open
incident rather than a growing pile.

## AIP format

See `docs/aip-format.md`.

## Restore

See `docs/restore-procedure.md`.

## API

All routes require a library-admin role (`super_admin`, `librarian`,
`faculty_librarian`, `admin`) and resolve the tenant from the caller.

| Route | Methods | Purpose |
|---|---|---|
| `/api/preservation/overview` | GET | Counts by fixity result, due files, incidents, restore runs, 7-day event trend, schedules, storage providers. |
| `/api/preservation/files` | GET, POST | List files with fixity state; POST triggers a manual recheck. |
| `/api/preservation/incidents` | GET, PATCH | List incidents; PATCH acknowledges or resolves. |
| `/api/preservation/restore` | GET, POST | List restore runs; POST restores an AIP into an allowed target. |

Unauthenticated requests receive `401 {"error":"Authentication required."}`;
non-admin callers receive `403 {"error":"Forbidden."}`.

## Dashboard

`/admin/preservation` (lazy route `AdminPreservation`) provides four tabs:
Overview, Files, Incidents and Restore. The nav entry is role-gated.

## Worker observability

`worker/health.ts` reports per-job-type counters (`byType`) and a `preservation`
block with `pendingJobs`, `lastProducerRunAt` and `lastVerifyRunAt`. The runner
invokes `onJob(jobType, outcome)` after every job and refreshes preservation stats
on each scheduler tick.

## Live verification

Two disposable-fixture scripts run against the hosted project and clean up after
themselves:

```
node_modules\.bin\tsx.cmd scripts\e2e-fixity-live.ts   # 37 checks
node_modules\.bin\tsx.cmd scripts\e2e-aip-live.ts       # 41 checks
```

The fixity script freezes every other repository file's `next_verification_at`
for the duration of the run and restores the original values afterwards, so the
run never re-verifies production files.

## Known limitations

- Backblaze B2 is not configured in this environment, so `b2Store()` reports
  `active: false` with an explicit reason and B2 writes are disabled.
- Other parts of the application still read objects via `storage.download()` and
  may observe CDN-cached bytes. Only preservation reads are cache-busting today.
- Fixity verifies bytes only. Format-level preservation (renderability, metadata
  quality) is out of scope.
