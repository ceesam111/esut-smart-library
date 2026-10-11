# SLAAS Quality Gates Evidence

Date: 2026-10-10 — final completion round, after next@16.4.0 upgrade, production build, and server restart.

## Static gates

| Gate | Command | Result |
|---|---|---|
| Lint (incl. eslint-plugin-security rules) | `node node_modules\eslint\bin\eslint.js . --max-warnings=0` | 0 errors, 0 warnings |
| Typecheck | `node node_modules\typescript\bin\tsc --noEmit` | clean |
| Unit/integration tests | `node node_modules\vitest\vitest.mjs run` | 766/766 (92 files, 76.6 s) |
| Coverage | `npm run test:coverage` | 54.21% lines / 51.38% statements / 42.22% branches / 54.34% functions (766/766 pass) |
| Production build | `node node_modules\next\dist\bin\next build` | green (exit 0), full route manifest |
| Secrets scan | `npm run scan:secrets` | 0 findings across 1002 tracked files (11 secret env values checked) |
| SAST scan | `npm run scan:sast` | 0 findings across 8 rules (10 pre-existing `eslint-disable` sites baselined in `scripts/.sast-baseline.json`) |
| Dependency audit | `npm audit --omit=dev` | 0 vulnerabilities (after next@16.4.0 upgrade) |
| Health | `GET /api/health` | 200 after final restart |

## Browser/API/worker E2E (production build on :3000) — final round

| Suite | Command | Result |
|---|---|---|
| SLAAS core (scan/visitor/correction/multi-branch) | `node scripts\e2e-slaas-live.mjs` | 86/86 |
| SLAAS mobile UX (375/414/768 px) | `node node_modules\tsx\dist\cli.mjs scripts\e2e-slaas-mobile-live.ts` | 38/38 |
| Internationalization (en/fr) | `node node_modules\tsx\dist\cli.mjs scripts\e2e-i18n-live.ts` | 13/13 |
| Accessibility | `node node_modules\tsx\dist\cli.mjs scripts\e2e-a11y-live.ts` | 20/20 |
| Privacy red-team | `node scripts\e2e-slaas-privacy-live.mjs` | 15/15 |
| Offline sync + perf ladder | `node scripts\e2e-batch14-offline-live.mjs all` | **41/41** (perf 10/10, 100/100, 500/500; retryable=0; 1,554,534 ms for 500) |
| SIP2 + TLS + restart | `node scripts\e2e-batch15-sip2-live.mjs` | 101/101 (216.2 s) |
| Workflow engine | `node node_modules\tsx\dist\cli.mjs scripts\e2e-workflow-live.ts` | 39/39 |
| Worker (notices + scheduled reports) | `node node_modules\tsx\dist\cli.mjs scripts\e2e-batch13-worker-live.ts` | 24/24 |
| Notices + delivery log | `node scripts\e2e-batch13-notices-live.mjs` | 34/34 |
| Reports (CSV/XLSX/saved/scheduling) | `node scripts\e2e-batch13-reports-live.mjs` | 21/21 |
| Search + analytics events | `node scripts\e2e-batch12-live.mjs` | 20/20 |
| Search (server-side) | `node node_modules\tsx\dist\cli.mjs scripts\e2e-search-live.ts` | 24/24 |
| Preservation AIP | `node node_modules\tsx\dist\cli.mjs scripts\e2e-aip-live.ts` | 41/41 |
| Fixity | `node node_modules\tsx\dist\cli.mjs scripts\e2e-fixity-live.ts` | 37/37 |
| **Total (15 suites)** | | **554/554 checks** |
| DR backup/restore (session) | `node scripts\backup-restore-slaas-live.mjs` | 29/29 (restore executed; loss-to-verified 42,247 ms) |
| Load test (session) | `node scripts\load-slaas-live.mjs` | PASS, 0 errors (see `slaas-load-test.md`) |

## Notes

- TypeScript E2E scripts run through `tsx` (`node node_modules\tsx\dist\cli.mjs <script>`), not bare `node`.
- Coverage is measured with `@vitest/coverage-v8`; the report is generated locally (`coverage/`, untracked).
- The `eslint-disable` baseline is ratchet-style: existing sites are recorded file-by-file; any new occurrence fails `scan:sast`.
- batch14 perf-500 ran to **500/500 with retryable=0** in the clean single-runner re-run (see `final-independent-red-team-audit.md` F-03/F-06 for the duplicate-runner incident and correction).
- batch15 harness fixes this round: 60 s SIP2 health waits (tsx cold boot ≈ 23 s), orphan-listener sweep, DB fixture pre-clean, persistent socket error handler, and a corrected bare-`%` LIKE verify (Cloudflare edge 500 had made it vacuous).
- DR and load test figures were produced earlier in the same session (post-upgrade); all other rows are from the final post-build round.
