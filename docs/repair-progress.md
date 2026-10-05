# Repair Progress — Batch 13

## Completed

### Notice System
- Expanded notice types from 5 to 28 (full taxonomy: circulation, account, repository, acquisitions, admin)
- Template model with variable schema, versioning, and channel support
- Variable rendering with HTML escaping and script tag stripping
- Template preview with SAMPLE DATA marking
- Template management API (list, preview, toggle, duplicate)
- Template permissions (global admin only)
- Email delivery via existing Resend + Gmail fallback
- In-app delivery via user_notifications table
- Print delivery via printer-friendly HTML
- SMS adapter architecture (optional, not configured)
- Checkout/checkin/hold-ready/due-soon/overdue notice dispatch API
- Workflow notice dispatch API
- Delivery logging with idempotency keys
- Delivery states (PENDING, QUEUED, SENT, DELIVERED, FAILED, CANCELLED, SUPPRESSED)
- Retry behavior with bounded retries
- Duplicate protection via idempotency keys
- Staff delivery history UI
- Test send endpoint
- Overdue worker (scans overdue loans, sends notices)
- Due-soon worker (scans due-soon loans, sends reminders)

### Report Writer
- Report builder with dataset/column/filter/sort/group support
- 8 datasets with column whitelists
- Sensitive column marking
- CSV export with formula-injection protection
- XLSX export (TSV-based)
- Saved reports (create/read/delete)
- Report run history
- Built-in report pack (12 reports)
- Report builder UI
- Report permissions (owner-based with shared/public visibility)

### Security
- Column whitelist enforcement
- Sensitive column detection
- Formula injection protection in CSV
- IDOR protection via ownership checks
- Template HTML script stripping

### Tests
- 12 notice template tests
- 12 report builder tests
- 6 delivery service tests
- Full suite: 557 passed, 0 failed

### Quality Gates
- TypeScript: 0 errors
- Lint: 0 errors on changed files
- Build: exit 0

## Not Completed / Limitations

- SMS provider not configured (adapter exists, status: NOT_CONFIGURED)
- No PDF report export
- No email delivery of scheduled reports
- XLSX export is TSV-based (not true OOXML)
- Templates stored in-memory by default (database table exists but not fully integrated)
- No live E2E for notices/reports (unit tests only)
- No scheduled report worker (infrastructure exists, not wired to cron)

---

# Batch 14 — Offline Circulation Completion

## Completed

### Engine and schema
- `offline_transactions` ledger + `offline_workstations` registry (migration `20261004310000_offline_circulation.sql`, applied and verified LIVE)
- Partial unique index `uq_circulation_transactions_offline_id` (migration `20261004320000_offline_circ_idempotency.sql`, applied and verified LIVE in `pg_indexes`)
- Claim-first idempotency (`client_txn_id` unique; fresh `PENDING` → `SYNC_IN_PROGRESS`; stale `PENDING` > 60s requeued; replay → `ALREADY_APPLIED`)
- Sequential, partial-apply-safe writes (loan → availability → circulation row) with prior-circulation short-circuit and partial-checkout reconciliation
- 12 conflict codes + rejected codes; override allow-list with mandatory note; `STALE_CACHE` 48h; `RULE_CHANGED` via `rules_fingerprint`; `OPERATOR_MISMATCH` guard
- Post-apply hooks only (analytics/idempotency, in-app notice, audit `source=offline_sync`, patron notifications, fine + fine notice on overdue check-in)
- Workstation `last_seq` = max applied seq, upserted after every batch

### API and UI
- `POST /api/circulation/offline-sync` (batch ≤ 500, per-txn results, `[sync-diag]` logging)
- `GET /api/circulation/offline-cache` (bounded 5-slice payload, truncation flags, `fetched_at`, `rules_fingerprint`)
- `POST /api/circulation/offline-resolve` (retry / accept_server / cancel / override)
- `GET /api/admin/offline-sync` (ledger + workstation monitoring with `last_error`)
- Client offline lib (`src/lib/offline/`: queue store, connectivity, cache, sync loop, `useOfflineCirculation`), `OfflinePanel` in the Circulation desk, `renewal` notice action in dispatch route
- Admin Offline Sync page at `/admin/offline-sync` with nav group

### Network resilience
- `expectOk` normalizes postgrest-js fetch failures (`{error, code:""}`) into retryable throws — the path that previously bypassed every retry
- `withNetRetry` (150/400/900/2000/4000ms ≈ 7.5s budget) for reads and absolute writes
- Lost-response recovery: claim ownership check, loan insert verification by `checkout_date`, unique-`offline_id` circ convergence, verify-then-reapply availability, `due_date` marker for renewals, existence checks for fine/notice inserts

### Tests and gates
- 41 offline-domain tests (24 engine, 3 route, 6 queue, 8 sync) incl. partial-apply recovery, prior-circ short-circuit, failed-insert no-side-effects
- Full suite: 621 passed / 82 files, 0 failed
- TypeScript: 0 errors; lint changed files: 0 problems; build: exit 0
- Live E2E gate5: **36/36 checks passed** (checkout, checkout→checkin, duplicate idempotency, conflict resolution, queue survival across server restart)
- Perf (live): size 10 → 32,682ms (tps 0.31); size 100 → 306,345ms (tps 0.33); size 500 → 1,565,476ms (tps 0.32), 500/500 applied, 0 retryable
- Offline cache preload: 5,320 bytes / 14 rows / 2,120ms, no truncation

## Not Completed / Limitations

- Offline hold fulfilment disabled by design (documented)
- No offline patron registration, fine payment, authority changes, acquisitions, repository ops (`REQUIRES_ONLINE`)
- Service worker (`esut-v1`) registers in production builds only
- Hook loss possible after apply if its insert fails (transactional truth beats telemetry; ledger stays `APPLIED`)
- Perf throughput is ~0.32 tps at ~427ms Supabase REST latency — acceptable for offline catch-up batches, not a bulk-import channel
