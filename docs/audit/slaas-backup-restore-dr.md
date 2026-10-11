# SLAAS Backup and Restore Disaster-Recovery Drill

Date: 2026-10-10
Scope: Smart Library Access & Analytics System (SLAAS) tables, SLAAS configuration, linked auth users, roles, and audit rows.
Companion documents: `docs/backup-restore-drill.md` (platform-wide drill procedure and RPO/RTO targets), `docs/backblaze-b2-backup-plan.md` (object storage), `docs/restore-procedure.md` (repository AIP restore, unrelated to database restore).

## What this drill proves

A full fixture covering the SLAAS acceptance surface can be backed up to a JSON snapshot, destroyed completely, restored, and verified entirely through the public API — with identifiers, state, statistics, and credentials preserved.

## Method

Script: `scripts/backup-restore-slaas-live.mjs` (lint-clean, `node scripts/backup-restore-slaas-live.mjs`, requires `E2E_BASE_URL` and `.env.local`).

Phases:

1. **Fixture** — officer (`super_admin`) and patron (`student`) auth users, linked patron record, academic calendar row (`DR SLAAS/2026`), branch `DR-SLAAS-A` with capacity change 10 -> 12 (two capacity-history rows), secure access identity, registered visitor with issued temporary pass, one closed visitor visit, one open patron visit (entry backdated 2 hours for duration verification), resulting analytics and audit rows.
2. **Backup** — snapshot of 13 tables (`academic_calendar`, `library_branches`, `patrons`, `access_visitors`, `library_access_identities`, `access_visits`, `access_events`, `access_visitor_passes`, `library_branch_capacity_history`, `analytics_events`, `audit_logs`, `user_roles`, plus auth users by id/email) into `scripts/.dr-backup.json`.
3. **Loss** — every fixture row and both auth users deleted (verified: 0 visits, 0 branches, 0 users).
4. **Restore** — auth users recreated with original ids (admin API), then tables re-inserted in FK order (`user_roles` -> `academic_calendar` -> `patrons` -> `access_visitors` -> `library_branches` -> `library_access_identities` -> `access_visitor_passes` -> `access_visits` -> `access_events` -> `library_branch_capacity_history` -> `analytics_events` -> `audit_logs`) with original primary keys and timestamps.
5. **Verify** — 17 post-restore API assertions plus 12 fixture/backup/loss assertions.

## Result

**29/29 checks passed.** Full transcript and machine-readable state: `scripts/.dr-state.json`; backup snapshot: `scripts/.dr-backup.json` (both are local evidence files, intentionally not committed).

Verified after restore:

| Acceptance item (PART XLIII) | Evidence check |
|---|---|
| restored users | both users sign in again with original ids; `user_roles` and `patrons.user_id` links intact |
| visits | list shows exactly 2 visits with original ids; statuses `checked_in`=1, `checked_out`=1 |
| open-visit state | the pre-loss open visit is still open after restore |
| occupancy | derived `currentlyInside`=1 and `capacity`=12 immediately after restore; 0 after post-restore checkout |
| reports | CSV export contains both restored visit ids |
| visitor passes | pass row restored with identical id, status, and `secure_token_hash` |
| analytics | `totalVisits`=2, `visitorVisits`=1 from restored visits, branch present in `byBranch` |
| personal history | patron `/api/access/me` shows the restored visit |
| academic period | calendar row restored with original id; visits keep academic stamping |
| audit trail | all 8 audit rows returned (actor and user columns) |
| QR credential after restore | scan works and completes a valid checkout with recalculated duration (121 minutes from restored timestamps) |

## Measured timings (fixture scale)

| Phase | Duration |
|---|---|
| backup | 4,497 ms |
| simulated loss (deletes) | 5,523 ms |
| restore | 4,500 ms |
| verification | 28,960 ms |
| loss to fully verified | 38,983 ms |

## RPO and RTO statement

- **This drill is a correctness test, not a capacity test.** Fixture-scale RTO (loss to verified state) was ~39 seconds; production RTO scales with database size and must be measured against a full-size dump restore. Platform targets in `docs/backup-restore-drill.md` remain authoritative: initial RPO 24 hours (database), initial RTO 4 hours (app) / 8 hours (full database and object verification).
- **RPO depends on backup cadence, not on this script.** The drill captures a consistent snapshot at a single point in time; anything written after the snapshot and before the loss is lost. For production: scheduled `pg_dump` (or Supabase PITR where available) is required to hold RPO at the documented target.
- **What the SLAAS backup covers:** SLAAS rows, branch/capacity configuration, academic period rows, roles, linked auth user ids/emails, and SLAAS audit/analytics rows — i.e. everything needed for the PART XLIII acceptance list.

## Limitations (explicit)

1. **Auth password hashes are not exported by this script.** Restore recreated users via the Supabase admin API with the drill password. Real credential recovery relies on Supabase Auth's own backup/PITR, not on this JSON snapshot.
2. **Object storage is out of scope.** Uploaded files live in Supabase Storage/B2 and are covered by `docs/backblaze-b2-backup-plan.md`, not by this database drill.
3. **Environment secrets are out of scope** (`.env.local`, service keys) — password-manager inventory per `docs/backup-restore-drill.md`.
4. **No scheduled automated backup was exercised here.** The drill validates restore correctness of a manually captured snapshot; scheduling/pipeline verification is a production-operations task.
5. **Single-tenant fixture scope.** Rows were selected by fixture patterns (`DR-*`); a production dump naturally contains all tenants and larger volumes.
6. **Observation (P2, non-blocking):** visitor pass `status` stays `active` after use (the `used` enum value is never set by the scanner). Expiry and revocation both work and are tested; a pass remains reusable inside its validity window, which matches current product behavior but should be confirmed as intended before production.

## Re-run instructions

```powershell
$env:E2E_BASE_URL = 'http://localhost:3000'
node scripts\backup-restore-slaas-live.mjs
```

Requires the dev/prod server running and `.env.local` service-role access. The script cleans up its own fixture on success and on failure.
