BATCH 14 CLOSURE — 52-Point Report
Status: ALL GREEN (gate5 36/36, perf 7/7, cache 4/4, 621 tests, tsc 0, lint 0, build 0)

1. Pre-build audit corrected: docs/offline-circulation-audit.md §2.8 — `fines` table exists
   (supabase/migrations/20260620202651_...sql:508); no `loan_fines` mismatch; Batch 14
   post-apply hook behavior documented
2. Migration 20261004310000_offline_circulation.sql applied to LIVE and verified
   (offline_transactions ledger, offline_workstations, offline_id column, device_seq unique)
3. Migration 20261004320000_offline_circ_idempotency.sql written and applied to LIVE:
   partial unique index uq_circulation_transactions_offline_id (verified in pg_indexes);
   online path never writes offline_id, so it is unaffected
4. OfflineStore implementation (src/server/circulation/supabaseOfflineStore.ts): ledger
   claim/update, workstation upsert, patron/item/loan/hold reads, all circulation writes
5. Claim-first idempotency: unique client_txn_id; fresh PENDING (<60s) → SYNC_IN_PROGRESS
   retryable; stale PENDING requeued; replay → ALREADY_APPLIED; hooks fire once
6. Batch validation: MAX_BATCH_SIZE = 500, UUID/shape checks, BatchValidationError surfaces 400
7. local_seq ordering: shuffled batches apply in device order (tested)
8. applyCheckout: reads parallelized; writes sequential loan → availability → circulation
   (partial-apply safe); server-computed due date from category rules (4/14/2, 8/30/4, 20/90/6, 6/21/3)
9. applyCheckin: returned-load short-circuit → ALREADY_APPLIED; overdue fine (50/day) +
   fine notice; next pending hold promoted server-side
10. applyRenew: renewal cap enforced; foreign pending hold → HOLD_CONFLICT; overdue guard;
    renewed_count incremented once
11. Conflict codes: ITEM_ALREADY_CHECKED_OUT, ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON,
    ITEM_ALREADY_RETURNED, PATRON_BLOCKED, PATRON_EXPIRED, MAX_LOANS_REACHED, LOAN_NOT_FOUND,
    LOAN_OVERDUE, RENEWAL_LIMIT_REACHED, HOLD_CONFLICT, RULE_CHANGED, STALE_CACHE
12. Rejected codes: INVALID_PAYLOAD, OPERATOR_MISMATCH, REQUIRES_ONLINE, PATRON_NOT_FOUND,
    ITEM_NOT_FOUND; UNKNOWN_ERROR for unexpected server faults; SYNC_IN_PROGRESS is retryable
13. Librarian override: OVERRIDE_ALLOWED_CODES = MAX_LOANS_REACHED, RENEWAL_LIMIT_REACHED,
    STALE_CACHE, HOLD_CONFLICT — force flag + mandatory note; other codes cannot be forced
14. Stale-cache guard: OFFLINE_CACHE_MAX_AGE_HOURS = 48 → STALE_CACHE until refresh;
    rules_fingerprint mismatch → RULE_CHANGED
15. Operator guard: queued_by must match the syncing operator unless a recovery role
    (OPERATOR_MISMATCH)
16. Workstation registry: last_seq = max applied local_seq (gaps do not advance it),
    last_sync_at/last_seen_at upserted after every batch
17. Hooks fire only after durable apply; fireApplied/fireResolved never downgrade APPLIED
18. Hook idempotency: analytics + in-app notice key offline:<client_txn_id>; audit log
    source=offline_sync; patron inbox notification
19. Overdue check-in side effects: fine row (unpaid, reference loan) + patron fine notice
20. Offline hold fulfilment deliberately disabled and documented; hold promotion stays online-only
21. POST /api/circulation/offline-sync: requireRole(LIBRARY_ADMIN_ROLES), per-txn results +
    summary counts, [sync-diag] logging of failures and ledger last_error
22. GET /api/circulation/offline-cache: bounded 5-slice payload (patrons 5k / items 20k /
    copies 40k / loans 10k / holds 5k) with truncation flags, fetched_at, rules_fingerprint
23. POST /api/circulation/offline-resolve: retry / accept_server / cancel / override with
    resolution, note, resolved_by, and audit trail
24. GET /api/admin/offline-sync: ledger monitoring (status, conflict_code, last_error,
    attempts, resolutions) + workstation rows for the admin UI
25. Client offline lib (src/lib/offline/): types, localStorage queue store, connectivity
    detector, cache fetch/store, sync loop with retryable resend, useOfflineCirculation hook
26. OfflinePanel component integrated into the Circulation desk (queue rows, sync now,
    connectivity pill); online path unchanged
27. Circulation.tsx offline path: checkout/checkin/renew enqueue with cache_fetched_at;
    queued transactions shown in the Offline Queue tab
28. Admin UI: Offline Sync page (/admin/offline-sync) with ledger table, workstation
    registry, resolution actions; nav group "Circulation" added (Circulation Desk + Offline Sync)
29. Dispatch route: renewal action added → renewal_confirmation notice type
30. Network resilience root fix: expectOk() detects postgrest-js fetch failures (returned as
    {error, code:""} — never thrown) and re-raises them as retryable TypeErrors, closing the
    silent no-retry path that stalled syncs (observed: workstation upsert last_seq=undefined)
31. withNetRetry with 150/400/900/2000/4000ms backoff (~7.5s budget) wraps all reads and
    absolute writes (ledger update, workstation upsert, setLoanReturned, promote-hold)
32. claimLedger lost-response ownership: network failure → sleep → re-read; row exists → our
    claim (unique client_txn_id); first-attempt 23505 → concurrent sender wins (SYNC_IN_PROGRESS)
33. insertLoan lost-response verify: on network error, re-read active loan; matching
    checkout_date → return existing id (no duplicate loan; clean RETRYABLE if truly absent)
34. insertCirculationTx: unique offline_id makes retry converge (23505 → success)
35. adjustAvailableCopies verify-then-reapply: re-read equals intended value → committed;
    unchanged → re-run once from fresh value; changed concurrently → loud failure (no double
    decrement, no orphan decrement)
36. setLoanRenewed: due_date marker verification + one guarded re-attempt; fine/notice
    inserts verify existence (reference_id+amount / patron+title+message) before re-insert
37. Engine reconciliation: prior circulation row short-circuits to ALREADY_APPLIED before
    business rules; partial checkout (loan+copies committed, circ row missing) detected by
    checkout_date match and completed — no false ITEM_ALREADY_CHECKED_OUT conflict
38. Tests: 41 offline-domain tests (24 engine incl. partial-apply recovery, prior-circ
    short-circuit, failed-insert no-side-effects retry; 3 route; 6 queue; 8 sync)
39. Full vitest suite: 621 passed / 82 files / 0 failed
40. tsc --noEmit: 0 errors (final state)
41. eslint changed files --max-warnings=0: 0 problems (offlineSync, supabaseOfflineStore,
    offlineSync.test, plus route/client files from earlier gates)
42. next build: exit 0 (final state)
43. Live E2E gate5: 36/36 checks passed — E2E-1 offline checkout (loan due=+14d, availability
    1→0, circ row with offline_id, workstation last_seq=1, ledger APPLIED attempts=1,
    analytics=1, audit=1, in-app notice=1, patron inbox=1)
44. E2E-2 checkout→checkin: loan status=returned, availability restored 0→1, checkin notice once
45. E2E-3 duplicate sync: ALREADY_APPLIED, no duplicate loan, no availability drift,
    hooks did not fire twice (analytics=1 notices=1)
46. E2E-4 conflict: ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON detected; librarian cancel
    resolution recorded (resolution/resolved_by) and audited (count=1)
47. E2E-5 restart: file-backed queue survives Next server restart; both txns APPLIED
    attempts=1; loans 2→4; workstation persisted and advanced last_seq=2
48. Perf (live, final build): size 10 → 32,682ms (tps 0.31); size 100 → 306,345ms
    (tps 0.33); size 500 → 1,565,476ms (tps 0.32) — 500/500 applied, 0 retryable
49. Offline cache preload measured: 5,320 bytes, 14 rows, 2,120ms, no truncation flags set
    (patrons=2, items=12, copies=0, loans=0, holds=0)
50. Evidence: LIVE DSN rule honored (live-sql.ps1 scp+ssh per statement); unique index and
    migrations verified via pg_indexes; server logs clean (0 fetch-failed warnings on final run)
51. Docs: docs/offline-circulation.md (architecture, API, codes, resilience, limitations,
    evidence) + docs/repair-progress.md Batch 14 section + audit §2.8 correction
52. Exclusions honored: no .env*, credentials, tsconfig.tsbuildinfo, check-health.cjs,
    next-prompt.md, post-implementation-prompt.md, docs/complete-feature-inventory.md,
    docs/features-by-role-and-benchmark.md, docs/platform-capability-summary.md, diag/*.sh
    scripts, or AGENTS.md committed; commit via `git commit -F` with explicit paths; push via
    PAT origin URL; Batch 15 (production SIP2) NOT initiated — STOP here per directive
