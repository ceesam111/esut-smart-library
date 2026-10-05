# Offline Circulation Audit — Batch 14 (14.1)

Auditor: DWC Batch 14 · Date: 2026-10-04 · Scope: current state of offline circulation
(checkout / checkin / renewal) before the Batch 14 rebuild.

## 1. What works today

| Area | Finding |
|---|---|
| Connectivity indicator | `src/app-pages/admin/Circulation.tsx` shows an Online/Offline pill driven by `navigator.onLine` plus `online`/`offline` window events (L115–124, L651–654). Detection only — no health probe, so "Online" can be wrong behind captive portals or when the API is down. |
| Local queue | An in-memory `OfflineTx[]` state mirrors localStorage key `circ_offline_queue` (L76–83, L113). Checkout while offline appends a record with `offline_id = crypto.randomUUID()` (L174–193) and shows a warning. Queue survives page reloads via localStorage. |
| Offline tab UI | A dedicated "Offline Queue" tab lists queued transactions with type/patron/item/time and a per-row Remove button, plus a "Sync Now (n)" button disabled unless online (L888–950). |
| Service worker | `public/sw.js` (cache `esut-v1`) precaches `/`, `/offline`, the manifest and icons; network-first for GET same-origin API, cache-first for hashed static assets; skips non-GET and cross-origin requests. Registered in production only by `src/lib/register-sw.ts`. |
| Health endpoints | `/api/health` returns `{ok, service, timestamp}`; `/api/health/supabase` and `/api/health/schema*` exist for dependency probing. |

## 2. What is dead, broken, or unsafe

### 2.1 `POST /api/circulation/offline-sync` is unusable
`app/api/circulation/offline-sync/route.ts` inserts into `circulation_transactions`
using columns that **do not exist**: `action`, `item_id`, `patron_id` (as used here),
`due_date`, `returned_date`, `fine_amount`. The real table
(`supabase/migrations/20260620204347…`) has `transaction_type`,
`patron_id`, `catalogue_item_id`, `loan_id`, `copy_barcode`, `performed_by`,
`performed_at`, `notes`, `offline_id`, `synced_at`. Every insert fails; the loop
never aborts and reports `error` per row but the route still answers `success: true`.
No idempotency, no ordering, no conflict handling, no audit, no UI caller.

### 2.2 `syncOffline()` in the Circulation page bypasses the API
`Circulation.tsx` L501–551 talks to Supabase directly from the browser:

- **Only checkouts are ever processed** — `tx.type === 'checkin'` has no branch, so
  check-ins queued offline are dropped from the queue (they fall through the
  `try` with no `remaining.push`)… actually they are silently **deleted**: the loop
  neither applies nor re-queues them.
- Checkout branch uses `patron_category` selected from `catalogue_items`
  (a column that does not exist on items) and `defaultLoanDays` (14) regardless of
  patron category — due dates diverge from online checkout rules.
- **Any thrown error re-queues the checkout forever** (L544–546) with no retry cap,
  no backoff, no error surface to the operator.
- Client-side `available_copies` decrement from a stale read (read-modify-write race).
- No idempotency: pressing Sync twice concurrently creates duplicate loans.
- Analytics (`trackClientEvent`) fires optimistically, so events can be recorded
  for transactions that later failed to apply.

### 2.3 Rules duplicated in the UI
`LOAN_DAYS` / `MAX_ITEMS` are hard-coded copies of `institutionConfig.loanRules`
(L61–74) and `dueDate()` (L152–157) computes locally. Online checkout, offline
checkout, and `syncOffline` each apply rules differently; there is no shared rules
module on the server (`src/server/circulation/rules.ts` does not exist).

### 2.4 Renewal does not exist at the circulation desk
Desk Circulation has no renew action. Renewal exists only in
`src/app-pages/dashboard/Loans.tsx` (patron self-service, `renewed_count`). Offline
renewal is entirely absent. → Batch 14 must add desk renewal, online + offline.

### 2.5 No device/workstation identity
No workstation ID, no device registration, no operator-bound queue lock. A queue
stored in localStorage on a shared machine could be submitted by a different
operator after logout.

### 2.6 No durable client store beyond localStorage
No IndexedDB; the queue and any patron/item cache live in `localStorage`
(synchronous, main-thread, ~5MB, cleared by storage pressure). No `idb` package
installed — raw IndexedDB or a small in-repo wrapper is required.

### 2.7 Scanner lookup does not work offline
`useBarcodeScanner` populates `itemQuery`, which triggers `searchItems()` → live
Supabase `.or(title.ilike, call_number.ilike)` with no barcode column and no
offline fallback (L141–150). Offline, search returns nothing; barcode
(`catalogue_copies.barcode`) is never queried even online.

### 2.8 Hold fulfilment, fines, notices
- `checkoutFromHold` (L415–463) requires a fresh server read → inherently online.
- `handleCheckin` inserts into `fines` — CORRECTION (Batch 14): the `fines`
  table exists in schema (`20260620202651_…sql:508`); there is no `loan_fines`
  table-name mismatch. Earlier audit text claiming a pre-existing table-name bug
  was wrong; the insert target is valid.
- Notice dispatch (`/api/admin/notices/dispatch`) and analytics fire from the
  client on the online path; offline path fires analytics at sync-time but not
  notices — semantics inconsistent. (Batch 14: offline sync now fires in-app
  notices + analytics + audit via post-apply hooks with `offline:<txn>`
  idempotency keys; see `docs/offline-circulation.md`.)

### 2.9 No conflict vocabulary
There are no conflict codes anywhere (item checked out elsewhere, patron suspended
while offline, loan already returned, renewal limit reached, hold conflict, stale
cache, rule change). The operator cannot distinguish "retry later" from
"needs a decision".

## 3. Storage inventory

| Store | Contents | Lifetime | Batch 14 verdict |
|---|---|---|---|
| localStorage `circ_offline_queue` | checkout-only queue | persists until manual remove | **Replace** with IndexedDB queue (order-preserving, bounded) |
| In-memory React state | queue mirror, `navigator.onLine` | page session | Replace with connectivity state machine + observable store |
| Supabase | loans, catalogue_items, circulation_transactions | authoritative | Keep — server apply target with idempotent ledger |
| IndexedDB | — | — | **New**: queue, patron/item cache, workstation/session state |
| Service worker cache `esut-v1` | app shell | until SW change | Keep; ensure offline shell covers circulation routes |

Cached data that an offline client needs: patron directory (id, patron_id, name,
category, status, user_id, membership expiry), catalogue items (id, title,
call_number, format, available/total copies, barcode), active loans for check-in
and renewal (id, patron, item, due_date, renewed_count, status), hold queue
(item-level), loan rules snapshot + fetched-at timestamp.

## 4. Sync semantics today vs required

| Semantics | Today | Required (Batch 14) |
|---|---|---|
| Endpoint | UI → direct Supabase (API dead) | `POST /api/circulation/offline-sync`, role-gated |
| Idempotency | none | `client_txn_id` unique ledger → `ALREADY_APPLIED` |
| Ordering | localStorage array order, per-tx independent | monotonic `device_id + local_seq`, ordered apply |
| Partial batch | silent per-row errors | per-transaction `APPLIED / ALREADY_APPLIED / CONFLICT / REJECTED / RETRYABLE_ERROR` |
| Conflicts | none | explicit codes (item checked out, patron blocked, loan missing, renewal limit, hold conflict, stale cache, rule changed, operator mismatch…) |
| Analytics/notices | client-fires optimistically | server-fires only after `APPLIED` |
| Audit | partial client audit | server audit row (operator, device, seq, before/after) |
| Concurrency | double-sync duplicates loans | client sync mutex + server ledger claim |
| Connectivity | `navigator.onLine` | state machine: ONLINE/OFFLINE/SYNCING/DEGRADED/SYNC_ERROR via `/api/health` probe |
| Offline auth | none | bounded offline staff session, no tokens stored, queue lock bound to operator |

## 5. Security model today

- `requireRole(request, LIBRARY_ADMIN_ROLES)` on the (dead) sync route; route errors
  are swallowed into HTTP 500 without `routeError` handling.
- Browser-side Supabase writes rely on RLS policies (`loans_insert` requires the
  patron themself — librarians write through the admin client or bypass this, an
  existing design quirk).
- No per-operator attribution for offline work; `performed_by` never set by the
  offline path.
- Batch 14 requirement: operator + workstation attribution on every applied
  transaction, role-gated sync, and explicit authorization for cross-operator
  queue recovery.

## 6. Scope decisions for Batch 14

- In scope: offline **checkout, checkin, renewal** with durable queue, idempotent
  ordered sync, conflict handling, admin monitoring, cache preload.
- **Hold fulfilment offline: disabled** (requires fresh server state by design;
  UI must show "Hold checkout requires connection" instead of failing silently).
- Explicitly out of scope: offline patron registration, offline fine payment,
  authority/label changes, acquisitions, repository operations, SIP2 (Batch 15).

## 7. Verdict

Offline circulation today is **cosmetic**: a localStorage list, a dead API route with
wrong columns, and a sync function that deletes check-ins and loops on checkouts.
Batch 14 replaces it end-to-end: shared rules module, IndexedDB-backed queue with
workstation identity and bounded offline session, server-side idempotent ordered
sync with a conflict vocabulary, and operator-facing pending/conflict queues.
