# PART LI — Final Independent Red-Team Audit

Date: 2026-10-10 · Reviewer stance: independent external auditor · Basis: `f62adf4` + this run's changes.
Method: every verdict cites an artifact produced in this codebase; no dimension is marked PASS on assertion alone. Fix rule applied: any internally-fixable P0/P1 found → fixed → retested → re-reviewed, without waiting for permission.

**Central question:** *What could prevent this combined ESUT + SLAAS platform from being safely operated by a serious university?*

---

## 1. Dimension verdicts

| # | Dimension | Verdict | Key evidence | Residual risk |
|---|---|---|---|---|
| 1 | Functionality | PASS | Final-round suites all green (554 E2E checks across 15 suites this session: batch14 41/41, SLAAS 86/86, SIP2 101/101, workflow 39/39, notices 34/34, fixity 37/37, AIP 41/41, mobile 38/38, reports 21/21, search 24/24, batch12 20/20, a11y 20/20, worker 24/24, privacy 15/15, i18n 13/13) | None material |
| 2 | Security | PASS (engineering) | `scan:secrets` 0/1002 files; `scan:sast` 0 findings (10 baselined legacy); `npm audit --omit=dev` 0; QR forged/replayed/expired/guessed all refused (attack E2E); 401/403/IDOR/cross-tenant suites; SWORD/COAR inbox authenticated; SSRF tests for Z39.50; error handler never leaks stacks | No third-party penetration test (external); baseline files must stay ratcheted |
| 3 | Privacy | PASS with P2 residual | `slaas-dpia-technical-input.md`; red-team 15/15 (PII-in-logs, IDs, export authz); opaque QR subject; log redaction module | Automated retention/deletion jobs are policy-not-code (P2, documented in DPIA) |
| 4 | Attendance correctness | PASS | Visit state machine (`visitState.test.ts`), occupancy invariants (`occupancy.test.ts`), E2E journeys check-in→out, corrections recompute + audit, capacity enforcement | None material |
| 5 | Analytics correctness | PASS | Metric catalogue tests, analytics-reconciliation E2E checks, small-cohort suppression tested, events sourced from actual visits | No historical backfill (events start at wiring date) |
| 6 | Accreditation evidence integrity | PASS | Reports carry provenance columns; audit trail for exports/corrections/sync; CSV formula-injection guarded; XLSX verified as real OOXML (PK magic) | PDF export limited to library card (documented) |
| 7 | Accessibility | PASS with caveat | batch17C WCAG 2.2 AA remediation; a11y E2E 20/20; axe-class checks | Engineering verification, not formal certification |
| 8 | Backup | PASS | DR suite 29/29 incl. scheduled backup execution; `slaas-backup-restore-dr.md` | Object-store (B2) backup needs credentials = external |
| 9 | Disaster recovery | PASS | Actual restore performed in DR suite; loss-to-verified 42,247 ms measured; safety gates tested | Provider-level restore depends on external credentials |
| 10 | Reliability | PASS with P2 residual | Worker E2E **24/24 this session** (overdue/due-soon notices, dedup, idempotency, missing-runId negative path); restart E2E; queue monitoring UI; bounded retry/backoff | Dead-letter queue + job priorities deferred (P2, no operational demand yet) |
| 11 | Scalability | PARTIAL (P2) | Load test 0 errors at recorded concurrency; perf ladder 10/100 green this run | 100k-record search scale untested; single-node worker; hosted DB ceiling observed under sustained write load |
| 12 | Performance | PASS with caveat | Load test PASS (0 errors); perf ladder fully green in clean run: 10/10, 100/100, **500/500 `retryable=0`** (1,554,534 ms ≈ 2026-10-04 baseline) | Hosted latency includes internet RTT; absolute numbers vary with remote-DB conditions |
| 13 | Maintainability | PASS | tsc 0, lint 0/0 (no `any`, no new `eslint-disable` — enforced by SAST scan), 766 vitest green, coverage 51.38% lines, documented deferrals | Coverage threshold gate deliberately not yet enforced |
| 14 | Interoperability | PASS with external items | OAI-PMH validated, SRU+CQL live, Z39.50 client live, SWORD endpoint, COAR Notify inbox hardened, MARCXML round-trip | ResourceSync/Signposting/OpenURL deferred (rationale in gap audit); CORE key, partner-repo SWORD validation = external |
| 15 | AI | PASS with external items | `src/server/ai/`: policy gate, provider router, redaction, safe JSON completion, usage logging; tests `aiBrain`, `aiPolicy`, `providerRouter`; agent admin (health/jobs/metrics/runs/schedules/templates) | Provider credentials external; no live LLM calls verified in this run (no key configured) |
| 16 | ILS | PASS with documented partials | PART L rows: MARC/authorities/circulation/SIP2/offline/notices/reports/KBART fixed; worker notices proven live | ILL lifecycle E2E absent; thesis library review partial; acquisitions/serials depth partial (see PART L) |
| 17 | Repository | PASS with documented partials | Secure download, versions, extraction, workflow, preservation AIP + restore-safety tests, DOI/handle | Bitstream multi-file depth partial; thesis library-review stage partial |
| 18 | CRIS | PARTIAL (mostly external) | ORCID/ROR proxies + tests, DOI minting wired | ORCID OAuth, ROR UI callers, Zenodo token = external/deferred |
| 19 | Operational support | PASS | Admin dashboards (circulation, workflow, holds, queue/offline monitoring), structured logging + request IDs, health endpoint, metrics routes, backup/DR tooling | No third-party error-tracking sink (service decision) |
| 20 | Platform upgrade (XLV) | PASS | next@16.4.0, `npm audit --omit=dev` = 0, full regression green after upgrade | None material |

---

## 2. Findings and dispositions

| ID | Severity | Finding | Disposition | Retest evidence |
|---|---|---|---|---|
| F-01 | P1 (test integrity) | Worker E2E failed 19/24: fixture inserted **two active loans for the same patron+item**, violating the correct constraint `loans_one_active_per_patron_item`; cascading failures on due-soon notice paths | **FIXED** — fixture now uses two distinct catalogue items (`scripts/e2e-batch13-worker-live.ts`) | Re-run **24/24 PASS** (2026-10-10, this session) |
| F-02 | P1 candidate (owner-reported) | Owner issue #3: "ILL submit broken" | **NOT REPRODUCIBLE — verified live**: patron-JWT insert of the UI's exact payload returns **201 + RLS readback**; `requestTypeForFormat` maps only to allowed values `borrow/copy/article`; authenticated INSERT policy present. Form degrades gracefully when no patron row exists (clear message) | Probe `probe-ill-submit.cjs` output: `ILL insert (user JWT): 201`, `readback: 200` |
| F-03 | P1 (evidence quality) | batch14 `perf-500`: 229 applied / 271 retryable (`SYNC_IN_PROGRESS`-class) in run #2, vs. **500/500 achieved 2026-10-04** in identical code | **FIXED + RETESTED**: (a) JWT refreshed per perf batch (fixes mid-run 401), (b) `PERF-FAIL-DETAIL` instrumentation added, (c) single-runner launch + ledger pre-clean verified — duplicate-runner interference eliminated as a confounder | **Clean re-run: 41/41 PASS** — perf-10 10/10 (32,963 ms), perf-100 100/100 (297,460 ms), **perf-500 500/500 (1,554,534 ms), `retryable=0`**, matching the 2026-10-04 baseline (1,565,476 ms) |
| F-04 | P1 (security gap) | CI lacked secrets and SAST scanning (original capability report gap) | **FIXED** — `.github/workflows/ci.yml` now runs `npm run scan:secrets` + `npm run scan:sast` after the audit step | Scans pass locally this session (0 findings / 1002 files each); CI wiring present in workflow file |
| F-05 | Process risk (tooling) | Batch14 was accidentally launched **twice concurrently**; the racing runners produced a `SYNC_IN_PROGRESS` flood that initially looked like database throttling | **FIXED** — both runners killed, stale state purged (33 fixtures + ledger), relaunched as verified single instance | Run completed **41/41** with zero conflicts |
| F-06 | Resolved | Run #2's 271 retryables could not be disambiguated between hosted throttling and duplicate-runner interference | **DISAMBIGUATED by F-03's clean re-run**: single runner on a rested ledger applied 500/500 with `retryable=0` — run #2's anomaly is attributed to the duplicate-runner race + stale state, not a product defect; the final report uses only the clean number | 41/41 clean re-run |
| F-07 | P1 (evidence-integrity, harness) | SIP2 batch15 re-run failed three ways: 25 s health wait vs ~23 s tsx cold boot (marginal), run-#1 skipped cleanup left 5 terminals + patron + 2 items poisoning reruns (`plainPassword` undefined → cascade), and a post-connect socket with no `'error'` handler crashed the process on ECONNRESET | **FIXED** — health waits raised to 60 s (default + TLS respawns), orphan-listener sweep at `main()` start, DB fixture pre-clean before terminal creation, persistent socket error swallow after connect, and phase14's bare-`%` LIKE verify (Cloudflare edge 500 → vacuous pass) corrected to `*` wildcard | **Re-run: 101/101 PASS (216.2 s)** |

### P2 residuals (internally known, consciously not fixed now)

1. Privacy retention/deletion not automated (policy documented; automation deferred).
2. Dead-letter queue and job priorities absent (bounded retry/backoff present).
3. ILL has no lifecycle E2E (submit verified live this session).
4. Thesis workflow lacks a dedicated library-review stage.
5. Scalability beyond recorded load (100k search scale) untested; single worker node.
6. ResourceSync / Signposting / OpenURL routes not wired (builders only; no consumers).
7. Data-quality dashboard absent (reports + audit cover the need; deferred under XLIX).
8. OpenAPI spec deferred (docs exist; no external API consumer yet).

### Blocked-external items (cannot be closed internally)

SSO/OIDC/SAML/LDAP (IdP), CORE API key, Zenodo/DOI token, B2 credentials, ORCID OAuth, Resend domain verification, physical card/PIN hardware, SUSHI publisher credentials, third-party pen test and accessibility certification.

---

## 3. Re-review statement

After fixes F-01, F-03, F-04, F-05, F-07 and the F-06 disambiguation, I re-reviewed all twenty dimensions with final-round evidence in hand: **no remaining internally-fixable P0 or P1 was found**. The findings that remain are P2 residuals (listed) and blocked-external items (listed). This review is considered closed for the PART LIII verdict; any regression surfaced by later runs reopens it.
