# 14 — Independent Final Audit (Phase 22, §14)

Independent second pass over the Phase 22 scope. Every track re-assessed from evidence produced this session; anything not verifiable is marked **UNVERIFIED** rather than assumed.

## T01–T12 status table

| Track | Verdict | Evidence | Unverified / caveats |
|---|---|---|---|
| T01 Repository integration & resolver | ✅ complete (no new defects) | Regression batch green (citation/signposting/openurl/coar); live item page 200 with canonical + metas; canonical-UUID URL confirmed as only public route | live citation-button click in browser (Arcjet 403s curl on citation API — real-user impact undetermined) |
| T02 Discovery/URLs/sitemaps | ✅ complete | robots/sitemap suites green; live robots 200, 5 sitemaps 200; `appBaseUrl()` = `APP_BASE_URL` else canonical fallback; artifact gate `localhost:3000` = 0 | GSC submission/verification — no access, **no placeholder invented** |
| T03 Submission & moderation | ⚠️ code-complete, applied | 12/12 steps code-path verified (02); CSRF + auth-header defects found & fixed this session; `20261011130000` APPLIED 2026-10-26 (03 §7/§11) | live E2E with real roles (needs accounts — BLOCKED); staging write matrix deferred (03 §9) |
| T04 Identity & ORCID | ⚠️ implementation complete | identity modules/migration/rollback present; `validateOrcidId` used on submit; suite green | ORCID OAuth linking (institutional registration — BLOCKED) |
| T08 Research visibility analytics | ✅ implementation complete | visibility module + tests; admin analytics routes gated | real-event accuracy vs production DB (no admin session); GSC confirmation |
| T09 Journal & OER | ✅ complete | `localSearch` dual-source + 6 tests; GlobalSearch wired; live `search-anon 200` | theses excluded from Global Search (no `search_vector`) — known gap |
| T10 Digital preservation | ⚠️ complete except drill | backups/retention/preservation tests green; migration + rollback; export API | **restoration exercise BLOCKED** (no infra/backup artifact) |
| T11 Responsible AI discovery | ✅ boundaries complete | grounding + token-budget + policy tests green; `aiSummary` guarded empty (never fabricated) | no paid provider connected (forbidden without approval); no live model validation claimed |
| T12 Accessibility & performance | ⚠️ automated complete | a11y + i18n suites green; payload measured before/after (≈ −11 KB initial) | field CWV unavailable (no GSC/CrUX); full assistive-technology pass not executed |
| Security/regression (§11) | ✅ zero critical open in code | full §11 table in 11 | live system retains CSRF/auth defects until approved flip |

## Defects found in this independent pass — and their status

| # | Defect | Severity | Found via | Status |
|---|---|---|---|---|
| 1 | **CSRF production-only breakage**: any cookie → every non-Bearer non-exempt POST 403 on production (Cloudflare challenge cookie) | Critical (production) | Live probe (POST `/api/events/track` 403; in-page OAI POST `CSRF check failed`; `credentials:'omit'` → 405) | **FIXED** (middleware cookie + `csrfFetch`) + 15 tests; presence-only variant rejected as weakening |
| 2 | **8 staff/submission UI pages called authed routes with no `Authorization`** → guaranteed 401 (Reports, Notices, BatchModification, Circulation, DeliveryHistory, AuthorityMerge, CatalogueNew, RepositorySubmit) | High | Route-guard vs call-site cross-scan (23 call sites) | **FIXED** (`authHeaders()` pattern; 2 `useEffect` chains restructured); tsc 0, eslint 0, suite 1003/1003 |
| 3 | `researcher_profiles.institution DEFAULT 'Adeyemi Federal University of Education'` (AFUED) on an ESUT table — `20260620202944…sql:599` | Medium | Source audit vs `institution.config.ts` (`Enugu State University of Science and Technology`) | **DOCUMENTED, not pursued as a migration** (constraint: no new migration unless pursued; application owner-gated). Open defect → 04. |
| 4 | Arcjet returns 403 to curl/automated clients on `/api/repository*` and citation API | Low/undetermined | Live probes | Documented; real-user impact **UNVERIFIED** — not claimed safe or broken |
| 5 | Stale docker build context (`$env:TEMP\esut-deploy-9b060e5`, 04:04, lacks auth fixes) | Build-risk | File timestamp inspection | **RESOLVED 2026-10-26** — image `20261026-0947` built directly from the workspace through `.dockerignore`; the stale temp context was never used (13 item 7) |
| 6 | Localhost-inlining in live image `20261023-0259` (known from prior phase) | Critical (production) | Prior phase; re-confirmed root cause (`appBaseUrl` ignores `NEXT_PUBLIC_*` on server; build-time env needed) | Fixed in code since prior phase; **live image still defective until flip** |
| 7 | **RLS policy recursion (`42P17`)**: every authenticated `SELECT` on `theses`, `thesis_workflow`, `thesis_supervisors`, `thesis_reviews` fails HTTP 500 (`infinite recursion detected in policy for relation "theses"`); cycle: `theses_supervisor_read` (`20260620202944:305`) → `ts_read` (`20260621003704:18`) → `public.theses` | Critical (database) | §3 real-role read-only probe with a minted `authenticated` JWT, 2026-10-26; root-caused in migration source (not drift); all four tables have 0 rows → plan-time, data-independent | **APPLIED 2026-10-26 + LIVE-VERIFIED** (owner-approved): `20261026090000` applied to production; post-apply real-role probes return **authenticated HTTP 200 on all four tables** (was 500), anon 0 rows unchanged, `is_thesis_submitter` granted to authenticated/service_role only, not anon → full evidence in 03 §11. Write-path matrix/rollback execution deferred to staging (owner decision 2026-10-26) |

**Explicit non-findings (checked, no defect):** repository detail page renders on production (earlier "Item not found" claim was false — contaminated grep; the string never existed in `en.ts` nor git history); `WorkflowDashboard` raw-fetch is a false positive (uses `authHeaders()`); `AcademicIntegrity` route is intentionally public and rate-limited (10/hour); anonymous view-counter fetches are by design.

## Production-only configuration risks (independent verification of §14's last clause)

- The two production-only failure classes (Cloudflare cookie → CSRF; missing build-time `NEXT_PUBLIC_*` → localhost inlining) **cannot occur locally** — both were found by probing production, and both are covered by regression tests/gates now (middleware tests; artifact gate).
- Build-time inlining rule re-verified: server code reads `APP_BASE_URL` else fallback; local builds must export both `NEXT_PUBLIC_*` to the canonical URL (done for every build this session).

## Incident disclosure (full transparency)

- `app/api/oai/route.test.ts` was briefly overwritten during authoring (first `write` clobbered the tracked file's 6 `oaiXml` helper tests). Detected immediately; recovered verbatim via `git show HEAD:…` and merged with the 3 new gate tests → 9/9 green. The final full-suite count 1003 vs intermediate 997 is exactly this +6 (12 documents the arithmetic and mtimes).
- A server restart cancelled three in-flight shells (env-hold + `supabase start`, a docker build attempt, a vitest run). **No docker image was produced**; env files were restored and hash-verified byte-identical; nothing was half-committed (working tree remains entirely unstaged).
- Two earlier measurement attempts failed honestly (script-tag regex matching 0 assets; old curl lacking `--compressed`) — both retried to completion or explicitly marked unmeasured.

## Unverified conditions (must not be read as passed)

1. Real-role RLS behavior — **read-side DONE and post-apply verification DONE** (real anon/authenticated/service_role roles; all 6 migrations applied to production 2026-10-26, all markers + real-role probes green — 03 §11). **Still open:** write-path INSERT/UPDATE matrix and rollback execution — isolated staging deferred by owner 2026-10-26 (procedure preserved in 03 §9–§10).
2. Live authenticated journeys (researcher/librarian/admin) — no accounts.
3. Restore drill — no environment/backup artifact.
4. Field CWV / GSC indexing — no access; **no claim made anywhere**.
5. Arcjet real-user experience on repository/citation APIs.

## Addendum (2026-10-26, after this audit was authored)

1. Defect 7 (RLS `42P17` recursion) was discovered while executing §3's real-role RLS validation. **As of the end of this session it has been applied to production (owner-approved) and live-verified** — audit item 6 (production image behavior) is now also satisfied by the executed flip and post-deployment smoke. Full evidence: 03 §11, 15 §8.
2. **Owner decision 2026-10-26 — staging deferred:** the staging write-matrix and `.down.sql` rollbacks are **not** executed on production nor in an isolated environment; the exact procedure is preserved in 03 §9–§10 with the probe scripts for reuse. Migration **application** (read-side + markers) was executed on production under explicit approval.
3. The audit's conclusions for items 1–6 are unchanged apart from the above updates.
