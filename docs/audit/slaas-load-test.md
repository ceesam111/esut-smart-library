# SLAAS Load Test Evidence

Date: 2026-10-10
Status: PASSED (post Next.js 16.4.0 upgrade regression run)

## Method

- Script: `scripts/load-slaas-live.mjs` (sequential + burst phases against the running production build on `http://localhost:3000`).
- Backend: remote Supabase (PostgREST) — every API call pays network round-trip; the direct-DB baseline below isolates that floor.
- Fixture: one load-test branch (capacity 100), 12 patrons, one circulation officer session.
- PASS criteria: every phase completes with zero HTTP/application errors, both 12-parallel bursts return all `200`, and final occupancy returns to `0` (no leaked visits).

## Results (2026-10-10, next@16.4.0)

| Phase | n | p50 (ms) | p95 (ms) | p99 (ms) | max (ms) | errors |
|---|---:|---:|---:|---:|---:|---:|
| Direct DB round-trip baseline (PostgREST x10) | 10 | 314.6 | 764.4 | 764.4 | 764.4 | 0 |
| QR validation, reject path (sequential x25) | 25 | 1865.3 | 6630.3 | 9516.3 | 9516.3 | 0 |
| Check-in (sequential x12) | 12 | 5931.8 | 12141.3 | 12141.3 | 12141.3 | 0 |
| Checkout (sequential x12) | 12 | 4574.4 | 6900.4 | 6900.4 | 6900.4 | 0 |
| Check-in burst (12 parallel) | 12 | 6329.8 | 7430.4 | 7430.4 | 7430.4 | 0 |
| Occupancy query (x6, occupancy=12) | 6 | 2404.6 | 3044.9 | 3044.9 | 3044.9 | 0 |
| Dashboard analytics (x10) | 10 | 2143.4 | 3775.3 | 3775.3 | 3775.3 | 0 |
| Attendance history (x10) | 10 | 1649.5 | 10357.7 | 10357.7 | 10357.7 | 0 |
| Report generation CSV (x3) | 3 | 2779.8 | 3681.5 | 3681.5 | 3681.5 | 0 |
| Checkout burst (12 parallel) | 12 | 5412.0 | 5979.2 | 5979.2 | 5979.2 | 0 |

- All burst check-in and check-out status codes: `200` x12.
- Final occupancy: `inside=0` (all visits closed out correctly).
- Summary line: `LOAD TEST PASSED`.

## Interpretation

- Zero errors in every phase, including both 12-parallel bursts — correctness under concurrency holds (no lost visits, no double occupancy).
- Observed latency is dominated by the remote PostgREST round-trip: mutating endpoints (check-in/check-out) chain multiple sequential round-trips (auth context → identity lookup → visit write → event write → occupancy recount), so p50 lands several multiples of the 314 ms DB baseline.
- The first request after idle pays cold-start cost (p95/p99 spikes), visible as single-sample outliers; sequential medians are the representative figure.

## Limitations

- This run tests the development-host → remote-database topology from one machine; it is not a same-region production benchmark.
- PASS is correctness-based (zero errors); no hard latency budget is enforced by the script.
- Concentration of load is 12 concurrent maximum; larger fan-outs are untested.
- Prior evidence run (pre-upgrade, 2026-10-10 earlier session) showed the same phases passing with p50 DB baseline 301.7 ms, check-in p50 5931 ms-class figures — the 16.4.0 upgrade did not change the performance profile.

## Re-run

```powershell
$env:E2E_BASE_URL='http://localhost:3000'
node scripts\load-slaas-live.mjs
```
