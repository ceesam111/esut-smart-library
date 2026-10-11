# SLAAS Acceptance Checklist (PART XLVIII)

Date: 2026-10-10. Evidence from the post-upgrade (next@16.4.0) regression run unless noted.
E2E commands run against the production build on `:3000`; unit/integration via `node node_modules\vitest\vitest.mjs run` (766/766).

Legend: **PASS** = proven by an automated check; **DOC** = proven by code/audit documentation.

## Identity and access

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | existing ESUT identity reused | PASS | SLAAS uses the existing Supabase auth + `patrons`/`user_roles` tables; all E2Es sign in through the existing `/login` flow (`e2e-slaas-live.mjs`: "all four sessions sign in") |
| 2 | no duplicate auth platform | DOC | No second auth store exists; `useAuth` resolves profile from `patrons.user_id` + `user_roles` only |
| 3 | branch configuration works | PASS | `e2e-slaas-live.mjs`: "administrator configures branch A (tenant_id injection stripped)", "branch B created", "branch configuration lists all three branches" |
| 4 | academic structure integrated | PASS | `src/server/slaas/academicPeriod.test.ts` (vitest); E2E "academic period exists (calendar row created)", "academic structure stamped on visit" |
| 5 | secure access identity works | PASS | E2E "personal identity endpoint registers institutional user", "secure access identity issued with QR credential"; mobile E2E identity POST 201 |
| 6 | QR contains no unnecessary PII | PASS | `src/server/slaas/qr.test.ts` + `qr.security.test.ts`; QR claims carry an opaque UUID `sub` only (no name/matric/email); privacy E2E 15/15 ("QR token must not echo or log") |
| 7 | QR validation server-side | PASS | E2E "malformed QR refused", "forged (wrong-secret) token refused", "random access identifier guessing refused", "replayed dynamic token refused", "expired dynamic token refused" |
| 8 | optional dynamic QR architecture safely implemented or explicitly deferred | PASS | Implemented: signed dynamic tokens with TTL/nonce rejected on replay and expiry (E2E checks above); visitor pass tokens are separate, expiring, and branch-scoped |

## Scanning

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 9 | scanning works | PASS | E2E "officer scans user in (CHECK_IN)", "identity confirmation displays name" (part of 86/86) |
| 10 | USB/manual/camera strategy defined | DOC | `src/app-pages/admin/AccessScanner.tsx`: USB keyboard-wedge form submit + camera (`useBarcodeScanner` mode qr) + manual credential entry; UI hint at `src/lib/i18n/dictionaries/en.ts:1664` ("Use a USB scanner (keyboard input), the camera, or type the credential manually"); barcode logic unit-tested in `src/features/barcode/barcodeUtils.test.ts` |
| 11 | duplicate scans safely handled | PASS | E2E "immediate duplicate rejected as duplicate not checkout", "visitor duplicate scan rejected", "double scan race produces exactly one check-in"; client scan debounce (5000 ms) covered by sleep-5700 E2E assertions |
| 12 | concurrent scans safe | PASS | E2E "double scan race produces exactly one check-in", "multiple open visits impossible (unique index holds)"; batch14 E2E-4 concurrent checkout conflict detection + resolution |

## Attendance loop

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 13 | check-in works | PASS | E2E "officer scans user in (CHECK_IN)", "manual check-in and check-out both work" |
| 14 | checkout works | PASS | E2E "valid checkout occurs"; batch14 offline checkout/check-in journeys |
| 15 | duration correct | PASS | E2E "duration calculated (~120 minutes)", "correction recalculates duration (45 minutes)"; `src/server/slaas/visitState.test.ts` |
| 16 | occupancy correct | PASS | E2E occupancy increase/decrease sequence (1→0), "final occupancy zero on both branches"; `src/server/slaas/occupancy.test.ts`; load test occupancy endpoint |
| 17 | capacity configurable | PASS | E2E "capacity configured (occupancy reports capacity 5)"; mobile E2E branch create with `capacity`, `capacityMode`, `warnThresholdPct` |
| 18 | incomplete visits handled | PASS | E2E "incomplete (open) visit created", "manual operation closes race visit", "occupancy corrected after closing incomplete visit"; `visitState.test.ts` |
| 19 | manual operations audited | PASS | E2E "manual operations audited" |
| 20 | corrections audited | PASS | E2E "correction written to audit trail", "analytics source data reflects correction", "unauthorized correction fails (403)", "cross-institution correction fails (VISIT_NOT_FOUND)" |

## Visitors

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 21 | visitor workflow works | PASS | E2E visitor journey: "visitor registered", "temporary pass issued with credential", check-in/analytics/checkout all pass |
| 22 | temporary pass expiry works | PASS | E2E "crafted expired visitor pass refused", "server-side pass expiry enforced and row marked expired", "pass revocation blocks scanning", "visitor pass is branch-scoped (cross-branch denied)" |

## Dashboards, analytics, reporting

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 23 | personal attendance history works | PASS | E2E "attendance history contains visit", "personal dashboard reflects visit" |
| 24 | admin/officer dashboards work | PASS | Officer/admin sessions in all E2Es; mobile E2E officer UI login; dashboards render with live data (analytics checks below) |
| 25 | analytics from actual visits | PASS | E2E "analytics reflects visit from actual data", "visitor analytics reflects visitor visits"; `src/server/analytics/eventCapture.test.ts` |
| 26 | period filters work | PASS | E2E "branch and period filters work" |
| 27 | branch filters work | PASS | E2E "branch-scoped analytics isolates branch B", "combined institution analytics include both branches" |
| 28 | academic filters work | PASS | E2E "academic filters work" |
| 29 | reports from actual data | PASS | E2E "report (CSV) reflects visit"; `src/server/reports/reportBuilder.test.ts` + `counter.test.ts` + `reportWriter.test.ts` |
| 30 | accreditation evidence center works | DOC | Accreditation evidence = `/admin/reports` compliance report builder + Norma agent (per PART XXII: compliance datasets, provenance, accreditation pack exports); covered by `e2e-batch13-reports-live.mjs` (20/20 on 2026-10-04) and re-run in the final gate suite; no separate "evidence center" page was built (not required) |
| 31 | CSV works | PASS | E2E "report (CSV) reflects visit"; batch13-reports "CSV export returns valid CSV"; load test CSV export measured |
| 32 | real XLSX where exposed | PASS | E2E "real XLSX where exposed (PK zip signature)"; batch13-reports "XLSX export is a real OOXML workbook"; `reportBuilder.test.ts` asserts `PK` magic bytes on `reportToXlsx` output |
| 33 | PDF where exposed | PASS | PDF is exposed only on `/dashboard/library-card` (client-side jsPDF). Live browser probe 2026-10-10: button `📄 PDF` downloads `library-card-*.pdf`, 1,091,499 bytes, magic `%PDF` |

## Privacy, security, quality

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 34 | privacy controls enforced | PASS | Privacy red-team E2E 15/15; DPIA technical input `docs/privacy/slaas-dpia-technical-input.md`; visit PII minimization in `qr.test.ts` |
| 35 | authorization negative-tested | PASS | E2E: 401 anonymous, student 403 on analytics/export/scan/corrections/capacity, cross-institution isolation (6 checks), IDOR 404 checks; `src/server/auth/permissions.test.ts` |
| 36 | mobile tested | PASS | `e2e-slaas-mobile-live.ts` 38/38 at 375/414/768 px |
| 37 | accessibility tested | PASS | `e2e-a11y-live.ts` 20/20; `src/lib/a11y.test.tsx`; baseline `docs/audit/batch17c-accessibility.md` |
| 38 | scanner load tested | PASS | `load-slaas-live.mjs` PASS, 0 errors: burst check-in p50 6329.8 ms, burst checkout p50 5412 ms, occupancy p50 2404.6 ms (see `slaas-load-test.md`) |
| 39 | backup includes SLAAS | PASS | DR E2E `backup-restore-slaas-live.mjs` 29/29: backup contains SLAAS tables incl. visitor pass rows |
| 40 | restore tested | PASS | Same suite: actual restore verified (loss-to-verified ≈ 42 s), "visitor pass row restored intact (status + token hash)" |
| 41 | audit documentation complete | DOC | `docs/audit/` suite: quality gates, load test, privacy red-team, DR, gap audit, reuse matrix, batch17 baselines; this checklist + `final-platform-capability-reconciliation.md` + `final-independent-red-team-audit.md` complete the set |

## Notes

- The batch14 offline E2E (`all` mode) completed **41/41 on 2026-10-10**: correctness journeys (E2E-1..5, duplicate, conflict, cache) plus the full perf ladder 10/10, 100/100, 500/500 with `retryable=0` (1,554,534 ms for 500). `runPerf` re-signs in per batch because a full run exceeds the 1 h JWT lifetime; the clean number comes from a verified single-runner run (see `final-independent-red-team-audit.md` F-03/F-06).
- "PDF where exposed" was verified with a live browser download; the probe script is temporary and not committed.
- No item on this list is claimed PASS without an automated check or a cited code/audit artifact.
