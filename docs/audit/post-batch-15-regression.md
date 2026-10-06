# Post-Batch-15 Regression Verification

Date: 2026-10-06 · Verified HEAD: `a34e54d` (branch `master`) · Method: independent re-verification at current HEAD — tests re-run live, code re-read, live database re-queried. Commit existence and historical reports were NOT accepted as proof.

## Verification commands executed at HEAD

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` | **exit 0** |
| Tests | `node node_modules/vitest/vitest.mjs run --reporter=dot` | **657 passed / 657 (83 files), 0 failed** |
| Lint | `node node_modules/eslint/bin/eslint.js . --max-warnings=0` | **FAILED — 948 problems (662 errors, 286 warnings)** |
| Build | `next build` (previous session, log verified) | exit 0 |
| Live DB | `live-sql.ps1` queries against ref `rnnjspkdhojoigncdgmy` | see rows below |
| Live prod | VPS containers `esut-app-new` / `esut-worker` / `esut-sip2` | healthy, `/api/health` 200, SIP2 loopback login OK (prior session evidence, re-check pending) |

## Batch-by-batch regression

| Batch | Claimed capability | Current evidence | Regression tests | Current status | Defects |
| --- | --- | --- | --- | --- | --- |
| 1 | Security closeout: SIP2 bcrypt credentials, private storage, Next.js CVE upgrade (→16.3.6), COAR hardening | `package.json` `next@16.3.6`; storage buckets `repository/theses/aip-exports` live `public=f`; `coar-security.ts` implements HMAC-SHA256 + timestamp drift + timing-safe compare + nonce replay + per-actor rate limit + SSRF-safe URL validation; inbox route enforces 401/409/400/429 before insert | `sip2/auth.test.ts`, `coar-security.test.ts`, `coar-notify.test.ts` all pass | **VERIFIED** (COAR is stronger than the historical "known exception" claimed — see note 1) | D1: nonce is claimed (DB insert) *before* signature verification — unauthenticated DB write possible; no rejection logging |
| 2 | TypeScript 0 errors, lint 0 errors, test discovery, CI gates | `tsc --noEmit` = 0 ✓; `vitest.config.ts` includes `app/**/*.test.ts` + `sip2/**/*.test.ts` ✓; `.github/workflows/ci.yml` has tsc + `eslint . --max-warnings=0` + vitest + build + audit ✓ | 657/657 pass; route tests run | **REGRESSED** — `eslint .` fails with **662 errors** at HEAD (never green repo-wide; historical "0 errors" was scoped to changed files only) | D2: lint gate red (948 problems: 294 `no-misused-promises`, 202 `no-floating-promises`, 94 parser-project errors, 50 unused vars, misc); D3: `tsconfig.json` excludes `src/views/**` (63 files) — layer is both dead and unlintable |
| 3 | Report-writer schema fix, circulation indexes, baseline docs | Live `pg_indexes` contains `loans_one_active_per_patron_item`, `idx_sip2_terminals_institution`; `saved_reports` schedule columns live | `reportBuilder.test.ts`, `reportWriter.test.ts` pass | **VERIFIED** | — |
| 4 | Federated-search failure isolation, ILL API route, worker AI observability, hold checkout, barcode, bitstream architecture | `app/api/ill/route.ts` exists (POST submit only); `resources/*` isolation tests pass; `barcodeUtils.test.ts`; `b2Client.test.ts`/`secureDownload.test.ts` pass | as listed pass | **PARTIAL** | D4: ILL is submit-only — no staff review/supplier/status progression API (see matrix I-ILL); claim was "API route", workflow depth still missing |
| 5 | File service, workflow engine foundation, preservation/AIP foundation, text extraction, fixity worker | `workflowService.test.ts`, `fixity.test.ts`, `checksum.test.ts`, `extraction/*` tests pass; worker registers `repository.extractText`, `preservation.*` jobs | pass | **VERIFIED** | — |
| 6 | Repository workflow engine closure | `workflowService.test.ts`, `workflowAuth.test.ts`, `app/api/workflows/[id]/transition/route.ts` (notice dispatch wired) | pass | **VERIFIED** | — |
| 7 | Preservation/fixity/AIP completion + thesis/workflow/DB reconciliation | `aipExport.test.ts`, `preservationRoutes.test.ts`, `restoreSafety.test.ts` pass; `supabase/migrations` reconciliation applied live | pass | **PARTIAL** | D5: no end-to-end **restore** has been executed (prompt §O) — restoreSafety is guard logic only |
| 8 | Full-text extraction, access-aware search, server-side facets | extraction engine + statuses in worker health; `search/indexModel.test.ts` pass | pass | **VERIFIED** (facet depth re-audit in matrix) | — |
| 9 | OAI-PMH 2.0 completion and external validation | `src/server/oai/service.test.ts` + `app/api/oai/route.test.ts` pass | pass | **PARTIAL** | D6: "external validation" not reproducible — no validation artifact in `docs/`; only 4 `repository_items` live; no OAI validation doc |
| 10 | SRU 1.2 + Z39.50 client | `sru.test.ts`, `app/api/sru/route.test.ts`, `z3950/{marcParse,pqf,ssrf}.test.ts` pass | pass | **VERIFIED** | — |
| 11 | MARC depth + authority control + batch mod + overlay/merge UI | `marc.test.ts`, `marcValidation.test.ts`, `marcXmlParser.test.ts`, `overlay.test.ts`, `itemPreservation.test.ts`, `duplicates.test.ts`, `importValidation.test.ts`, `app/api/authorities/route.test.ts` pass | pass | **VERIFIED** | — |
| 12 | Analytics capture, filters, segmentation, CSV, observability, live E2E | 22 production `captureEvent`/`recordEvent` call sites (recursive grep); `eventCapture.test.ts`, `batch12.test.ts`, `app/api/admin/analytics/route.test.ts`, `observability/metrics.test.ts` pass | pass | **VERIFIED** (code); production sample maturity LOW: 8 events (adoption, not correctness — see matrix) | — |
| 13 | Notices (28 types/templates/channels/states), overdue+due-soon workers, report writer UI, scheduled reports, security controls | worker registers `notices.overdue`, `notices.dueSoon`, `reports.scheduledRun`; `worker/index.ts` imports `enqueueDueScheduledReports`; `saved_reports.schedule_*` columns live; `xlsx.ts` builds a **genuine OOXML ZIP workbook** (TSV claim is obsolete); delivery tests pass | `notices.test.ts`, `deliveryService.test.ts`, `templateRepository.test.ts`, `reportScheduler.test.ts`, `reportWriter.test.ts`, `reports/counter.test.ts` pass | **PARTIAL** | D7: templates in-memory defaults (persistence TBD in matrix); D8: SMS adapter `NOT_CONFIGURED`; D9: 0 production notice rows (adoption) |
| 14 | Offline checkout/check-in/renewal with ledger, conflicts, APIs, client queue, admin tooling | migrations `20261004310000`, `20261004320000` applied live (`uq_circulation_transactions_offline_id` in `pg_indexes`); engine/route/queue/sync tests pass | `offlineSync.test.ts`, `app/api/circulation/offline-sync/route.test.ts`, `src/lib/offline/*` pass | **VERIFIED** | perf ~0.32 tps documented (catch-up only, not bulk) |
| 15 | SIP2 listener, admin UI, terminal management, TLS hooks, deployment | `sip2/listener.test.ts` + `src/server/sip2/*` pass; production deployment evidence recorded in `docs/sip2-deployment.md`; containers healthy prior session | pass | **VERIFIED** (internal) / **BLOCKED EXTERNAL** | D10: Hostinger firewall TCP 6000; TLS cert not issued; real-device interop untested; external test must use origin IP (Cloudflare proxy) |

## Global defects discovered in this regression (implementation queue)

1. **D2 (P0):** `npm run lint` / CI lint gate fails at HEAD — 662 errors. CI on `master` cannot pass.
2. **D1 (P0):** COAR inbox claims nonce into `coar_nonces` (DB insert) before signature verification → unauthenticated DB write / nonce-burning; rejections are not logged.
3. **D11 (P0):** KBART endpoint 500s for every caller (synthetic `new Request('http://localhost')` instead of the incoming request) — reproduced by code inspection at HEAD.
4. **D12 (P1):** 18 npm vulnerabilities (1 critical `seroval`, 2 high `js-yaml`, `source-map-js`) — see `docs/audit/esut-phase2-master-matrix.md`.
5. **D3 (P1):** Dead layers: `src/views/**` (63 files), `src/main.tsx`, `index.html`, `vite.config.ts`, `src/integrations/supabase/auth-{attacher,middleware}.ts`, deps `@tanstack/react-router`, `@tanstack/react-start`, `mammoth` — all unreferenced by the live Next.js app (`app/page.tsx → ClientAppWrapper → src/App.tsx → @/pages/* = src/app-pages/*`).
6. **D13 (P1):** ILL workflow depth (submit only).
7. **D5 (P1):** No executed AIP restore test.

## Notes

1. **Note 1 (COAR):** the historical "known exception: COAR Notify inbox remains insufficiently authenticated" from batch 1 does **not** match HEAD. The inbox requires `x-coar-signature`/`x-coar-timestamp`/`x-coar-nonce`, verifies HMAC-SHA256 over `timestamp.payload` with `COAR_NOTIFY_SHARED_SECRET` (≥32 chars, else 503), enforces ±300 s drift, timing-safe compare, replay protection, per-actor rate limit, payload/actor/target validation, and idempotent duplicate handling. Remaining gaps are ordering (D1) and logging — addressed in Batch 16.
2. Statuses used: VERIFIED / REGRESSED / PARTIAL / BLOCKED EXTERNAL / UNVERIFIABLE (per prompt §3).
3. Data-maturity numbers (4 repository items, 8 analytics events) are adoption measurements, not feature-correctness signals (prompt §8) and do not lower any status above.
