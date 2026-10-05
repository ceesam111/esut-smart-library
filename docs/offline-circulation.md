# Offline Circulation — Batch 14

Librarian-facing offline checkout, check-in, and renewal with a durable local
queue, idempotent server sync, conflict handling, and auditable server
records. Built and verified against the live Supabase instance on
2026-10-04.

## Scope

| In scope | Out of scope (documented, enforced) |
|---|---|
| Offline checkout | Offline hold fulfilment (disabled — see below) |
| Offline check-in | Offline patron registration |
| Offline renewal | Offline fine payment |
| Durable queue + idempotent sync | Authority changes, acquisitions |
| Conflict detection + librarian resolution | Repository operations |
| Post-apply hooks (analytics, notices, audit) | Production SIP2 device interoperability |

## Architecture

```
Circulation UI (online path unchanged)
  └─ offline path → localStorage queue `circ_offline_queue`
       └─ POST /api/circulation/offline-sync (batched, ≤500 txns)
            └─ validateBatch → claim-first ledger (offline_transactions)
                 └─ per txn, in local_seq order: applyCheckout / applyCheckin / applyRenew
                      └─ Supabase store (src/server/circulation/supabaseOfflineStore.ts)
                 └─ post-apply hooks (only after durable apply)
                 └─ workstation upsert (last_seq = max applied seq)
```

Key modules:

- `src/server/circulation/offlineSync.ts` — validation, claim/ledger state
  machine, business rules, conflict codes, apply outcomes, hooks.
- `src/server/circulation/supabaseOfflineStore.ts` — `OfflineStore`
  implementation with lost-response resilience (below).
- `src/server/circulation/offlineSyncHooks.ts` — analytics event, in-app
  notice, audit log (`source: offline_sync`), patron notification; fired only
  after the transaction is durably APPLIED, never for conflicts.
- `app/api/circulation/offline-sync/route.ts` — batch sync endpoint.
- `app/api/circulation/offline-cache/route.ts` — cache preload.
- `app/api/circulation/offline-resolve/route.ts` — conflict resolution.
- `app/api/admin/offline-sync/route.ts` — admin ledger monitoring.

## API surface

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/circulation/offline-sync` | POST | library admin roles | Sync a queued batch; returns per-txn results + summary. |
| `/api/circulation/offline-cache` | GET | library admin roles | Bounded offline cache preload (patrons, items, copies, loans, holds). |
| `/api/circulation/offline-resolve` | POST | library admin roles | Resolve a conflicted txn: `retry`, `accept_server`, `cancel`, `override`. |
| `/api/admin/offline-sync` | GET | admin | Ledger/workstation monitoring (statuses, `last_error`, resolutions). |
| `/api/health` | GET | public | Reachability probe used by the sync UI and E2E. |

## Queue and sync semantics

- **Client txn identity**: every queued txn carries a `client_txn_id` (UUID)
  and a monotonically increasing `local_seq`. The server sorts by `local_seq`
  before applying so a shuffled batch replays in device order.
- **Claim-first idempotency**: the ledger row (`offline_transactions`) is
  inserted first with a unique `client_txn_id` (`uq_...device_seq`). The
  claimer applies; everyone else sees `SYNC_IN_PROGRESS` (fresh `PENDING`
  within `PENDING_CLAIM_TTL_MS = 60_000`) and returns a retryable result.
  `PENDING` older than 60s with no completion is re-claimed (crash recovery).
- **Batch limits**: `MAX_BATCH_SIZE = 500` (validation error above it).
- **Workstation**: `offline_workstations.last_seq` is upserted to the maximum
  applied `local_seq` after each batch (gaps allowed — failed txns don't
  advance it).
- **Ledger statuses**: `PENDING` → `APPLIED` / `ALREADY_APPLIED` /
  `CONFLICT` / `REJECTED` / `RETRYABLE_ERROR`; resolutions write
  `resolution` + `resolved_by` (+ note). `RETRYABLE_ERROR` rows keep
  `last_error` for the check endpoint and admin UI.
- **Resolution actions**: `retry` requeues, `accept_server` marks the local
  txn as superseded, `cancel` discards it with an audit trail, `override`
  re-applies with `force` (only allow-listed codes, mandatory note).

## Conflict and rejection codes

Conflicts (state-based, resolvable):

| Code | Meaning |
|---|---|
| `ITEM_ALREADY_CHECKED_OUT` | Same patron already holds this item. |
| `ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON` | Another patron holds it. |
| `ITEM_ALREADY_RETURNED` | Loan already returned. |
| `PATRON_BLOCKED` / `PATRON_EXPIRED` | Patron not in good standing. |
| `MAX_LOANS_REACHED` | Loan cap for category reached. |
| `LOAN_NOT_FOUND` / `LOAN_OVERDUE` | Check-in/renew target missing or overdue. |
| `RENEWAL_LIMIT_REACHED` | Renewal cap reached. |
| `HOLD_CONFLICT` | Foreign pending hold blocks renewal. |
| `RULE_CHANGED` | Loan rules changed since the client cached them (payload `rules_fingerprint`). |
| `STALE_CACHE` | `cache_fetched_at` older than `OFFLINE_CACHE_MAX_AGE_HOURS = 48`. |
| `SYNC_IN_PROGRESS` | Another sync holds the claim (retryable). |

Rejected (permanent for this payload): `INVALID_PAYLOAD`,
`OPERATOR_MISMATCH`, `REQUIRES_ONLINE`, `PATRON_NOT_FOUND`,
`ITEM_NOT_FOUND`. `UNKNOWN_ERROR` marks unexpected server errors.

**Override allow-list** (librarian + mandatory note): `MAX_LOANS_REACHED`,
`RENEWAL_LIMIT_REACHED`, `STALE_CACHE`, `HOLD_CONFLICT`.

## Idempotency and lost-response safety

Two layers make duplicate/replayed syncs safe:

1. **Ledger claim** on `client_txn_id` — the same txn can only be applied
   once per claim cycle; replays return `ALREADY_APPLIED`.
2. **`circulation_transactions.offline_id` unique index**
   (`uq_circulation_transactions_offline_id`, partial, where not null —
   migration `20261004320000_offline_circ_idempotency.sql`) — the audit row
   itself cannot duplicate. The online path never writes `offline_id`, so it
   is unaffected.

Engine-level guards:

- A prior circulation row for `client_txn_id` short-circuits any operation to
  `ALREADY_APPLIED` before business-rule evaluation.
- Checkout reconciles a **partial apply**: writes are sequential
  (loan → availability → circulation row), so a failure after the loan
  committed is detected by matching the active loan's `checkout_date` to this
  transaction's timestamp, and the missing circulation row is completed
  instead of reporting a false `ITEM_ALREADY_CHECKED_OUT` conflict.

## Network resilience (Supabase REST)

Measured REST latency is ~400ms/call and undici occasionally fails at the
socket level (`TypeError: fetch failed`). postgrest-js converts those into a
**returned** `{error}` with `code: ""` — a plain error path bypasses all
retries, which previously stalled syncs (`RETRYABLE_ERROR`, workstation
`last_seq=0`). The store now normalizes every network-shaped error into a
retryable throw and recovers per-method:

- Reads and absolute writes (ledger update, workstation upsert, loan returned,
  promote-hold) — `withNetRetry` (150/400/900ms backoff).
- `claimLedger` — retries the insert; a duplicate after our own network
  failure is re-read and treated as our claim (unique `client_txn_id`).
- `insertLoan` — on network failure, re-reads the active loan; a row with
  this checkout timestamp means the insert committed → return its id.
- `insertCirculationTx` — unique `offline_id` makes retry converge (`23505` →
  success).
- `adjustAvailableCopies` — verify-then-reapply: if the re-read equals the
  intended value, the update committed; if unchanged, run it once more from
  the fresh value; if changed concurrently, fail loudly.
- `setLoanRenewed` — `due_date` marker check + one guarded re-attempt.
- Fine/notice inserts — existence verification
  (`reference_id`+amount / patron+title+message) before any re-insert.

Known residual risks (documented, acceptable): a fine/notice can be lost if
its insert fails after its verification read also fails; a renewal can
double-increment `renewed_count` only if the marker write and its verification
both fail in a specific order; check-in's circulation row can be missing
after a lost response (audit row only — loan state is correct, and the ledger
stays `RETRYABLE_ERROR` for manual review).

## Offline cache preload

`GET /api/circulation/offline-cache` returns five bounded, ordered slices —
`patrons`, `items`, `copies`, `loans`, `holds` — each with `truncated` flags
(hard limits: 5,000 / 20,000 / 40,000 / 10,000 / 5,000 rows), plus
`fetched_at` and `rules_fingerprint`. The client stores `fetched_at`; checkouts
older than 48h raise `STALE_CACHE` until refreshed. Payload size is recorded
in the verification evidence below.

## Post-apply hooks

Fired only after durable apply (never for conflicts/rejects), once per
`client_txn_id` (idempotency key `offline:<client_txn_id>` for analytics and
in-app notices):

- analytics event (`offline_checkout` / `offline_checkin` / `offline_renew`)
- in-app notice to the patron's linked user (only when `user_id` is linked)
- audit log with `source: offline_sync`
- patron inbox notification (e.g. checkout receipt, hold ready)
- overdue check-in: fine + fine notice (amount = overdue days × 50)

## Deliberate limitations

- **Offline hold fulfilment disabled**: check-in promotes the next pending
  hold server-side (online), but the offline path never marks holds ready.
- **No offline patron registration, fine payment, authority changes,
  acquisitions, or repository operations** — `REQUIRES_ONLINE`.
- **Service worker** (`esut-v1`) registers in production builds only; the
  dev/preview E2E exercises the queue through `localStorage`, not offline
  page loads.
- **Analytics/notice hook idempotency** relies on the idempotency key; if a
  hook insert fails after apply, the transaction stays `APPLIED` and that hook
  is not retried (transactional truth beats telemetry).

## Verification (Batch 14 gates)

- TypeScript: 0 errors (`tsc --noEmit`).
- Lint: 0 problems on changed files (`eslint --max-warnings=0`).
- Tests: 621 passed / 82 files (includes 24 offline-sync engine tests +
  3 route tests; new tests cover partial-apply recovery, prior-circulation
  short-circuit, and failed-insert no-side-effects retry).
- Production build: exit 0.
- Live E2E gate (`scripts/e2e-batch14-offline-live.mjs gate5`):
  **36/36 checks passed** — offline checkout (loan/due date/availability/
  circulation row/ledger/hooks/audit/notices), checkout→checkin round trip,
  duplicate sync (`ALREADY_APPLIED`, no drift, hooks once), conflict
  detection + librarian resolution + audit, queue survival across a server
  restart (file-backed queue, both loans applied, workstation `last_seq=2`).
- Database: partial unique index applied to LIVE and verified in
  `pg_indexes`.

Performance and cache measurements: see `PERF`/`CACHE` lines in the Batch 14
report (`e2e-batch14-summary-perf.json` / `-cache.json`).
