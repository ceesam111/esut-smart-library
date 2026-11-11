# 15 — Phase 22 Final Report (§15 / §16)

**Project:** ESUT Virtual Library
**Date:** 2026-10-26 (updated after same-day production deployment)
**Scope:** ESUT only (never AFUED). Continues from commit `6ed0312`; all Phase 22 changes remain **uncommitted/unstaged** (porcelain: 107 entries, **staged 0**), per session policy.

---

## 1. Executive summary

Phase 22 implementation is **complete and deployed**: T03's blockers were resolved (CSRF production breakage, 8 pages calling authed routes without `Authorization`), T04 and T08–T12 gaps were closed to their feasible extent, the verified image was **pushed and flipped to production**, and the **6 pending migrations were applied to the production database** — each step owner-approved and verified live. Every automated gate is green on the final state:

| Gate | Result (final state, 2026-10-26) |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npx eslint` (84 changed TS files, `--max-warnings=0`) | **exit 0** |
| `npx next build` (both `NEXT_PUBLIC_*` = `https://virtuallibrary.esut.edu.ng`) | **exit 0** |
| Phase 22 Docker image | **built, pushed, DEPLOYED**: `ghcr.io/ceesam111/esut-smart-library:20261026-0947` (480 MB, digest `sha256:24477bb95d45…`) — image gate `localhost:3000` = 0, CSRF bundles present; Coolify `running:healthy` after flip (18:30:23) |
| Pending DB migrations | **6/6 applied to production (owner-approved), transactional, all markers green post-apply** |
| Post-deploy live verification | health 200 · home 200 with **no** `localhost:3000` · robots/sitemaps/OAI/FAQ 200 · **CSRF: positive passes, mismatch 403, evil-origin 403** · **42P17 gone: authenticated 200 on all 4 thesis tables** · `has_any_role` → 200 `false` |
| Full suite, serial `--maxWorkers=1` (115 files) | **1003 / 1003 passed, exit 0** (691 s; earlier authoritative run 93 s) |
| Targeted regression batch T01/T02/T05–T07 (18 files) | **203 / 203 passed** |
| Inline artifact gate (2,228 output files) | `localhost:3000` = **0**, `explore.proquest.com` = **0**, `accountid=189761` = 3 (ESUT's own public ProQuest link — content, not a leak), `virtuallibrary.esut.edu.ng` = 14 (canonical) |
| Env integrity | 8 `.env*` files present; **7/7 hold-copy SHA-256 match** (`.env.local` has no hold copy; BOMs are original — see 03 §9) |
| Test baseline | 797 → **1003** (+206, all new/extended; zero removed/skipped/disabled) |
| i18n | No new user-visible strings were introduced by T09/CSRF/auth changes — nothing to add to `en.ts`/`fr.ts` |

**The defining result of this phase** came from §3's mandated real-role RLS validation: exercising production with real `anon`/`authenticated`/`service_role` JWTs surfaced a **live critical database defect** — `42P17 infinite recursion detected in policy for relation "theses"` — breaking every authenticated `SELECT` on `theses`, `thesis_workflow`, `thesis_supervisors` and `thesis_reviews`. Root cause was traced into the migration source (a policy cycle), fix migration `20261026090000_fix_rls_policy_recursion.sql` + rollback were prepared, and after owner approval the whole 6-migration set was applied to production on 2026-10-26 and verified: the four tables now return **200** for authenticated roles. This is exactly the defect class mocked tests cannot catch. Full evidence: **03 §6 + 03 §11**.

**Release-readiness classification: CONDITIONALLY READY** (§8 below; definitions per brief §16; originally classified NOT READY — the re-classification is documented with its evidence in §8).

---

## 2. What was delivered

| Track | Outcome | Detail |
|---|---|---|
| T03 Submission & moderation | Blockers **resolved in code AND live** | CSRF fix (middleware cookie + `csrfFetch`, 15 tests) and auth-header fix (`authHeaders()` across 8 files / 23 call sites); 12/12 code paths verified. **Live post-flip proofs: positive POST passes middleware, mismatched token 403, evil origin 403 → 02, 13** |
| RLS validation (§3) | **Defect found → fixed → applied → live-verified** | 3 real roles exercised read-only; 9-check matrix with line citations; 42P17 root-caused; all 6 migrations applied 2026-10-26 (owner-approved) with post-apply markers + authenticated 200 on 4 tables. Staging write-matrix + rollback execution still deferred by owner → 03 |
| T04 Identity & ORCID | Feasible scope complete | identity modules, duplicate detection, affiliation, `validateOrcidId` on submit; identity migration applied; ORCID OAuth BLOCKED (institutional registration) → 05 |
| T08 Research analytics | Complete | visibility module + tests; view-counter functions deployed; admin routes gated; GSC claims absent → 06 |
| T09 Journal & OER | Complete | dual-source `localSearch` + 6 tests wired into Global Search → 07 |
| T10 Preservation | Complete except restore drill | backups/retention/preservation green; migration applied; **restoration exercise BLOCKED** → 08 |
| T11 AI discovery | Boundaries complete | grounding/token-budget/policy tests; `aiSummary` fails closed; no paid provider → 09 |
| T12 Accessibility & performance | Automated complete | a11y + i18n suites; payload ≈ −11 KB; field CWV unavailable → 10 |
| Security regression (§11) | Zero critical open — **live included** | full table in 11; the three previously-live defects (CSRF, auth-header, localhost) are fixed by the approved flip → 13 |
| New defect (this phase) | **42P17 — found, fixed, deployed, verified** | 03 §6, 14 defect #7 (now resolved) |

## 3. Deliverables (15/15)

All files in `docs/esut-modernization/phase-22/`, filenames exactly per brief §15:

1. `01_BASELINE_VERIFICATION.md` ✅ 2. `02_T03_BLOCKER_RESOLUTION.md` ✅ 3. `03_RLS_STAGING_VALIDATION.md` ✅ 4. `04_REMAINING_FEATURE_GAPS.md` ✅ 5. `05_T04_IDENTITY_ORCID.md` ✅ 6. `06_T08_RESEARCH_ANALYTICS.md` ✅ 7. `07_T09_JOURNAL_OER.md` ✅ 8. `08_T10_PRESERVATION.md` ✅ 9. `09_T11_AI_DISCOVERY.md` ✅ 10. `10_T12_ACCESSIBILITY_PERFORMANCE.md` ✅ 11. `11_SECURITY_REGRESSION.md` ✅ 12. `12_FULL_TEST_RESULTS.md` ✅ (incl. flaky causes, §13) 13. `13_PRODUCTION_DEPLOYMENT_CHECKLIST.md` ✅ (deployment record + verification) 14. `14_INDEPENDENT_FINAL_AUDIT.md` ✅ (defect #7 addendum) 15. `15_PHASE22_FINAL_REPORT.md` ✅ (this file)

Each shows actual evidence, resolved problems, remaining issues and verification results.

## 4. Verification results

- **Tests:** final-state serial run **1003/1003 (115 files, exit 0)**; regression batch **203/203**; baseline 797 preserved and exceeded. One parallel attempt on 2026-10-26 (launched without `--maxWorkers=1`) degraded to timeouts on the loaded machine — every affected file re-verified green in isolation; root cause documented as flaky cause 5 in 12. No test was ever skipped, disabled or deleted.
- **Type/lint/build:** tsc 0; eslint exit 0; `next build` 0 with canonical env; artifact gate clean.
- **Deployment (2026-10-26, owner-approved):** image pushed to ghcr (1 resumed network timeout) → Coolify PATCH tag + POST deploy → `running:healthy` → smoke green (health, home w/o `localhost:3000`, robots, 3 sitemaps, OAI Identify, FAQ).
- **Migrations (owner-approved):** pending set determined behaviorally (no tracking table exists in this DB): boundary probes proved everything ≤ `20261005130000` applied and exactly 6 unapplied (`theses_insert_own`=0, `versions_read_anon` qual=`true`, schedule/column/function markers all 0). All 6 applied transactionally (`ALL_APPLIED=6`); all 7 markers green post-apply (`versions_read_anon` now restricted EXISTS).
- **Real-role probes:** pre/post matrices in 03. Post-apply: authenticated **200** on all 4 thesis tables (was 500 `42P17`), anon unchanged 0 rows, `has_any_role` → 200 `false`.
- **CSRF live proof:** `GET /` sets cookie → matching same-origin POST passes middleware (reaches route validation, was 403) → mismatch 403 → evil origin 403.
- **Incident records:** the `oaiXml` test recovery (+6), env-file restoration (7/7 hash), and the parallel-suite degradation are all disclosed in 12 and 14 rather than smoothed over.

## 5. §16 pre-deployment checklist

| Brief §16 item | Status | Evidence / gap |
|---|---|---|
| All necessary migrations reviewed | ✅ **reviewed AND applied** | All 100 reviewed; the 6 pending applied 2026-10-26 (owner-approved, transactional) with post-apply markers; rollbacks: 5 `.down.sql` + one-row delete for `20261011140000` |
| Backups available, recovery validated | ⛔ **not validated** | Restore drill BLOCKED (T10) — no environment/backup artifact |
| Secrets/env documented | ✅ | 13 documents all keys; live gaps: `OAI_TOKEN_SECRET` **absent**, `NEXT_PUBLIC_APP_URL` **absent** (`NEXT_PUBLIC_APP_BASE_URL` present); env files byte-intact |
| Restricted content access secure | ✅ **validated post-apply** | Both storage buckets private; anon 0 rows on `user_roles`/`patrons`/thesis tables; authenticated 0 rows (no widening); `has_any_role` → `false`; CSRF negative probes 403 |
| Essential user journeys work | ⚠️ **defects fixed; real-account validation pending** | Live blockers removed: CSRF (positive POST passes, negatives 403), missing-`Authorization` pages (code-fixed, deployed), 42P17 (authenticated 200 on 4 tables). **Remaining:** end-to-end journeys need real test accounts (owner item) |
| Security-critical tests pass | ✅ | 1003/1003 incl. CSRF (7), `csrfFetch` (8), IDOR/security, OAI gate; regression 203/203 |
| Application builds successfully | ✅ | `next build` exit 0; artifact gate clean; image built, pushed, deployed, healthy |
| Existing functionality intact | ✅ | regression 203/203 + full suite + post-flip live probes (health/home/robots/sitemaps/OAI/FAQ all 200) |
| Monitoring & rollback procedures exist | ⚠️ partial | Image rollback tags `20261023-0259`/`20261020-2101`; rollback SQL for 5 migrations + one-row delete; monitoring = Coolify + `/api/health`; 24 h observation unexecuted; no CWV/GSC (no claim) |
| Institutional approvals identified | ✅ | 13 lists them; **obtained:** build, push, flip, migration application. **Outstanding:** env vars, PAT rotation, Resend DNS, Turnstile, deposit policy, GSC, ORCID OAuth, test accounts, staging for write-matrix/rollback execution |
| Outstanding risks documented | ✅ | 04, 11, 13, 14, 03 §6, and §7 below |

## 6. Defect ledger

**Fixed this phase AND live-verified (2026-10-26):**
1. **CSRF production breakage** — deployed; positive/negative live proofs in 13/§4.
2. **8 pages missing `Authorization`** (23 call sites) — `authHeaders()` fix deployed (full journey proof needs test accounts).
3. **42P17 RLS recursion** — fix migration applied to production; authenticated reads 200 on all 4 tables.
4. **Localhost-inlining in the live image** — new image deployed; homepage contains no `localhost:3000`.

**Open — technical:**
1. `researcher_profiles.institution` DEFAULT `Adeyemi Federal University of Education` (AFUED) on an ESUT table — documented, migration not pursued (scope/consent) → 04.
2. Missing production env vars `OAI_TOKEN_SECRET`, `NEXT_PUBLIC_APP_URL` → 13.

**Open — undetermined (not claimed safe or broken):** Arcjet 403s curl on `/api/repository*` (real-user impact unverified).

**Open — blocked validations:** §3 write-matrix + rollback execution (staging deferred by owner), restore drill, authenticated end-to-end journeys (no test accounts), field CWV/GSC.

## 7. Blockers and dependencies (nothing silently skipped)

1. **Staging for §3 write-matrix + rollback execution** — **owner decision 2026-10-26: deferred**. Migration *application* is no longer blocked (executed on production with approval); the write-matrix and rollback *execution* remain unexecuted; 03 §9–§10 hold the exact procedure.
2. ~~Build + flip~~ — **executed 2026-10-26** (push, Coolify flip, migrations: all owner-approved).
3. **Restore drill** environment/backup artifact (T10).
4. **Test accounts** for authenticated live journeys (researcher/librarian/admin).
5. Institutional items: ORCID OAuth registration, GSC, GitHub PAT rotation, Resend DNS, Turnstile, deposit policy, production env vars.

## 8. Release-readiness classification (§16)

> **READY:** all mandatory gates passed and required approvals obtained.
> **CONDITIONALLY READY:** no known release-blocking technical defect, but specified approvals or operational checks remain.
> **NOT READY:** one or more essential technical or security conditions remain unsatisfied.

### Original classification (earlier on 2026-10-26): **NOT READY**

At that time two essential technical conditions were unsatisfied: (1) the 42P17 recursion made every authenticated thesis read return 500 live (fix prepared but never executed anywhere), and (2) mandatory §3 validation — migration application in particular — was blocked for lack of staging. The live image also still carried the CSRF/auth-header/localhost defects.

### Re-classification (after the approved deployment, 2026-10-26): **CONDITIONALLY READY**

All four known release-blocking technical defects are now **fixed and live-verified**:

| Defect | Fix | Live evidence |
|---|---|---|
| 42P17 authenticated-thesis 500s | `20261026090000` + `20261011130000` applied | authenticated **200** on all 4 tables; anon 0 rows unchanged |
| CSRF 403 on legitimate POSTs | middleware + `csrfFetch` in image `20261026-0947` | positive POST passes; mismatch 403; evil origin 403 |
| Authed routes called without `Authorization` | `authHeaders()` 23 call sites in deployed image | deployed (end-to-end journey proof pending test accounts) |
| `localhost:3000` inlined in live image | rebuilt with canonical env | image gate 0; live homepage has no `localhost:3000` |

Remaining items are approvals/operational checks, none of which is a known release-blocking technical defect:

1. Real test accounts + end-to-end authenticated journey validation (operational; the blocking defects are already fixed).
2. Restore drill (T10) — operational validation, procedure documented in 08.
3. §3 write-matrix + rollback *execution* in staging — owner-deferred validation; application verified, negative probes confirm the policy set behaves (403s + anon 0 rows).
4. Production env vars (`OAI_TOKEN_SECRET`, `NEXT_PUBLIC_APP_URL`), 24 h post-flip observation, GitHub PAT rotation, Resend DNS, Turnstile keys, GSC, ORCID OAuth, deposit policy.
5. Documented non-blocking open defects: AFUED default (04), Arcjet curl-403s (impact undetermined).

**Path to READY:** conditions 1–4 discharged (accounts created + journeys signed off, restore drill executed, staging write-matrix/rollback run when staging exists, env/institutional items cleared) — then a fresh §16 checklist pass.

No deployment or production-database modification was performed without explicit owner approval; approvals for the image build (earlier), and for push/flip/migration application (2026-10-26), were obtained explicitly before each action.

## 9. Explicit non-claims

No Google Search Console / indexing claim anywhere. No field CWV claim. No paid model providers. No new third-party integrations. The 42P17 fix migration was statically reviewed first, then **applied under explicit approval and verified by real-role probes** (not merely claimed). All database probes remained read-only apart from the explicitly approved migration transactions; no test/seed data was written; minted JWTs used a non-existent subject; no secret values were printed (credentials passed via stdin/environment only).

## 10. Approvals

1. ~~Provision isolated staging~~ — owner chose **"Defer staging" (2026-10-26)**; write-matrix/rollback execution remain deferred (03 §9–§10 hold the procedure).
2. ~~Build the Phase 22 image~~ — **approved and executed (2026-10-26)**.
3. ~~Push + flip + apply the 6 migrations~~ — **approved ("continue to deploy to production", "Apply all 6 now") and executed (2026-10-26)**; all verification green (13).
4. Remaining owner decisions: test accounts, restore-drill window, env vars, PAT rotation, Resend DNS, Turnstile, GSC, ORCID OAuth, deposit policy, staging when available.
