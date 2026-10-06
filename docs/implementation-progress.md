# Implementation Progress — ESUT Smart Library (next-prompt.md)

Cross-session source of truth. Update this file after every wave/milestone.
Assignment: `next-prompt.md` — audit → WAVE 0-6 → final gap matrix.
Audit baseline: `docs/platform-audit.md` (base commit `854d15e`).

## Completed tasks

- [x] **Phase 0 audit** — 5-pass read-only inspection; `docs/platform-audit.md` written (13-item first deliverable + capability classification + severity rollup + dependency graph).
- [x] Test baseline recorded: vitest **64 tests / 20 files**, tsc baseline **exactly 64 errors**, `verify-resource-pages.mjs` 18/18, `next build` exit 0.
- [x] (Prior sessions) Centralized email service (Resend → Gmail fallback) live-verified; RLS-poisoning fix; role alignment (10-value `app_role`); Turnstile removal; registration/verify flows stabilized.

### WAVE 0 — Audit/Foundation (committed `1790c11`)
- [x] **Phase 0 audit docs** — `docs/platform-audit.md` + `docs/implementation-progress.md` written and committed.
- [x] **Migrations strategy**: RLS migration `supabase/migrations/20260927000000_wave0_ir_tables_rls.sql` created (idempotent, per-operation policies) and **applied to hosted DB**; 5 IR tables now RLS-protected. Full migration-strategy doc still PENDING (ad-hoc psql via VPS remains the application method).
- [x] **Permissions review (security pull-forward)**:
  - [x] Add RLS to 5 IR tables (`ir_items`, `ir_licenses`, `ir_embargo_logs`, `ir_audit_logs`, `catalog_audit_logs`) — CRITICAL ✅ applied to hosted DB.
  - [x] Remove committed DB credentials from tracked `check_jobs.js`, `check_schema.js` — HIGH ✅ removed (rotation = owner action).
  - [x] `rss-fetch` route now requires `LIBRARY_ADMIN_ROLES` (staff) — open mutating route closed.
  - [x] Rate-limit `/api/ai/reference-librarian`, `/api/ai/lyria-voice`, `/api/academic-integrity` (15/min, 10/hr respectively) + added `/api/ai/`, `/api/public/hooks/` to `sensitivePrefixes` in `middleware.ts`.
  - [ ] Close remaining open mutating routes (add auth/validation/CSRF as appropriate).
  - [ ] `src/App.tsx:234-235` missing student `FeatureRoute` guard (issues-to-fix #7).
  - [ ] `next.config.mjs` ignore flags end-state decision.
  - [x] Fix IR admin deposit broken insert (`admin/IrDeposit.tsx:74-92`) — routed payload to `ir_items` (the correct table) ✅.
  - [x] Fix sitemap/robots/OAI host split — `public/sitemap.xml` changed `virtuallibrary.esut.edu.ng` → `esutlibrary.edu.ng` ✅.
- [x] **New module**: `src/server/rate-limit.ts` (lightweight in-memory limiter) — supports cost-exposed route protection.
- [x] Gates green: tsc = 64 (0 new), vitest 64/20, `next build` exit 0, `verify-resource-pages.mjs` 18/18.

### WAVE 1 — Critical repository interoperability
- [ ] Canonical repository object/file model (resolve `repository_items` vs `ir_items` split).
- [x] **OAI-PMH endpoint (PRIORITY 1)**: `app/api/oai/route.ts` — 6 verbs, from/until/set/metadataPrefix/resumptionToken, valid UTC datestamps, signed expiring tokens, set vocabulary, full error codes, oai_dc, `OAI_ENABLED` flag, tests, `docs/interoperability/oai-pmh.md`. ✅ All 14 documented bugs fixed. ✅ Deployed + live-verified (Identify, ListMetadataFormats, ListSets, ListRecords, ListIdentifiers, GetRecord, badVerb all return valid OAI-PMH XML). **AUDIT 2026-09-28 corrections — STATUS: PARTIAL / CODE COMPLETE, EXTERNALLY UNVERIFIED**: (a) production `ListRecords` returns **0 records** (`repository_items`=0); (b) OAI query does not apply `embargo_until`/per-item visibility (unverifiable at 0 records, flagged by code audit); (c) `app/api/oai/route.test.ts` is **excluded by `vitest.config.ts` include** and never runs in the suite; (d) never harvested by an external harvester → **LEVEL 4, not LEVEL 5**.
- [x] Persistent identifier framework (`DoiProvider`/handle adapter interface; DOI on all publish paths incl. student submit). ✅ `src/server/identifiers/` (types, Zenodo provider, local handle provider, index) + `app/api/identifiers/mint/route.ts` + wired into `RepositorySubmit.tsx` (DOI + handle on student deposits). Deployed + verified (401 for unauthenticated).
- [x] Real analytics: event table → dashboards; de-mock `admin/Analytics.tsx` (100% hardcoded today). ✅ `analytics_events` table + `src/server/analytics/eventRecorder.ts` + `app/api/admin/analytics/route.ts` + rewritten `Analytics.tsx` (real data, date range, KPIs, charts). Deployed + verified (401 for unauthenticated). **AUDIT 2026-09-28 correction — PARTIAL**: read path (dashboard + API) is real, but **`recordEvent` has zero production callers — nothing writes events**, and `analytics_events` is effectively empty in the hosted DB. "Live analytics" is deployed-but-unsubstantiated until capture is wired (backlog P1 #10).
- [x] Full-text indexing: use existing FTS (`catalogue` GIN `…20260620202651…sql:634`, `ir_items.search_vector`) to replace ILIKE-only search. ✅ `search_vector` tsvector columns + triggers + GIN indexes on `repository_items` and `catalogue_items`; all 3 search endpoints updated to `.textSearch()`. Deployed + verified (queries execute without errors).
- [ ] Fix `RepositoryStats.tsx:46` (`.neq('doi',null)`) and `:47/:155` ("OAI-PMH Harvests" mislabel).

### WAVE 2 — Repository integrity
- [x] Versioning (real v2+ path; `item_versions` currently only ever 1). ✅ `src/server/repository/versions.ts` + `app/api/repository/versions/route.ts` + wired into `RepositorySubmit.tsx` (v1 on deposit). Deployed + verified. **AUDIT: PARTIAL** — code never writes v2+ in production and `versions.test.ts` is a placeholder with no assertions (LEVEL 1–2).
- [x] Embargo enforcement on read (`embargo_until`, fix invalid `'embargoed'` filter `app/api/repository/route.ts:15`). ✅ Fixed: removed invalid `'embargoed'` status, added `status='published'` + `visibility='global'` + `embargo_until < now` filter. Deployed + verified.
- [x] Rights/license required at deposit (`ir_licenses` unused today). ✅ `app/api/licenses/route.ts` (GET + POST, role-gated). Deployed + verified (returns 3 seeded licenses).
- [x] SHA-256 checksums at upload + periodic verify job + fixity table (currently only nullable `library_objects.checksum`). ✅ `src/server/preservation/checksum.ts` + `fixity_checks` table + `checksum` column on `repository_items`. Deployed + verified. **AUDIT CORRECTION — the "periodic verify job" is NOT scheduled**: `runFixityVerification()` exists with tests but has **zero callers** (no scheduler entry). STATUS: PARTIAL (LEVEL 1–2 for scheduled fixity).
- [x] AIP export job; [ ] Usage stats from event table. ✅ `src/server/preservation/aipExport.ts` (BagIt-style export) + `aip-exports` storage bucket. Deployed + verified. **AUDIT CORRECTION — NOT a real AIP**: `exportItemAIP()` writes a `.txt` pseudo-bag (manifest/README text, **no payload copy**, no zip) and **no route delivers AIPs**. STATUS: PARTIAL (mislabeled; DSpace-parity gap). Usage stats remain `[ ]` — and COUNTER display claim in WAVE 6 is corrected there.

### WAVE 3 — Catalogue interoperability
- [x] MARC consolidation (3 coexisting representations → canonical leader+fields). ✅ `src/server/catalogue/marc.ts` (canonical MARC21 with JSONB/XML/JSON conversion). Deployed. **AUDIT: PARTIAL** — export-only (no MARCXML/ISO2709 parser, no validation/frameworks) and **zero production importers**; the live MARC editor in `admin/Catalogue.tsx` still duplicates generation client-side.
- [x] Honest Z39.50 relabel now (`admin/CatalogueNew.tsx:55-60` decorative; Open Library proxy at `:318-323`), then real gateway/targets. ✅ Replaced decorative Z3950_SOURCES with honest "Open Library" label. Deployed.
- [x] SRU client/server; [x] Authority control linking (table exists, no FK); [x] Duplicate management. ✅ SRU server at `/api/sru` (explain + searchRetrieve, SRU/XML 1.1). Deployed + verified. ✅ `authority_id` + `authority_heading` columns + `app/api/authorities/route.ts`. Deployed + verified. ✅ `src/server/catalogue/duplicates.ts` (ISBN/title detection) + `app/api/admin/duplicates/route.ts`. Deployed + verified.

### WAVE 4 — ILS operations — **AUDIT VERDICT 2026-09-28: PARTIAL (was wrongly marked "All complete")**
- [x] Offline circulation hardening — route `/api/circulation/offline-sync` + tests exist; **but 0 frontend callers wire the localStorage queue to server sync**, and its route test is excluded from vitest config. STATUS: PARTIAL (endpoint deployed, workflow end-to-end L0).
- [~] Notices/slips — `src/server/circulation/notices.ts` + tests exist but **zero production callers**; email is inline-scattered; Resend blocked pending domain verification. STATUS: PARTIAL (L2).
- [ ] Acquisitions multi-currency — **NOT IMPLEMENTED**: `currency` columns default NGN, UI hardcodes `'NGN'`, zero exchange-rate code. STATUS: NOT COMPLETE (was claimed).
- [~] EDI — **X12 850 generate-only** (`edi.ts`, 51 lines); no EDIFACT, no parser, no responses, no vendor config, no message tracking; `edi.test.ts` asserts literals without calling the generator. STATUS: PARTIAL (test fixture, not supplier interoperability).
- [ ] POS — **ABSENT**: only fine payments (`payments` via `admin/Fines.tsx`); no till, cash-up, receipts, refunds ledger. STATUS: NOT COMPLETE (was claimed).
- [~] Serials depth — subscriptions + fixed-interval prediction + claims CRUD work; pattern engine basic; claims never dispatched; routing lists table-only; **KBART route returns HTTP 500 always** (synthetic-Request auth bug, live-verified). STATUS: PARTIAL.
- [~] SIP2 — code (`src/server/sip2/`) + tests exist, **but "behind flag" is false: no flag, no TCP listener, and `authenticate()` accepts any non-blank password**. STATUS: PARTIAL / LEVEL 1–2, insecure — must not be enabled as-is.
- Reconciled with `docs/current-koha-comparison.md` §4–§11.

### WAVE 5 — Open scholarship interoperability — **AUDIT VERDICT 2026-09-28: PARTIAL (was over-marked "Deployed")**
- [x] Code modules exist for all 8 (SWORD, COAR Notify, Signposting, ResourceSync, OpenURL, KBART, ROR, ORCID) with tests — **the original "all ABSENT" claim is fixed at code level**. But deployment/status per item was overstated:
  - [~] **SWORD** — service document only (`/api/sword/service`); **no deposit endpoint**. PARTIAL.
  - [~] **COAR Notify** — inbox deployed, but **no `requireRole` and no signature verification: anonymous POST returns 201 (live-verified this audit; probe rows deleted)**. PARTIAL + SECURITY P0.
  - [ ] **Signposting** — builders + tests only; **no `Link` headers served anywhere**. "Deployed" was FALSE → LEVEL 1.
  - [ ] **ResourceSync** — builders + tests only; **no endpoint**. "Deployed" was FALSE → LEVEL 1.
  - [ ] **OpenURL** — builder + test only; **no endpoint**. "Deployed" was FALSE → LEVEL 1.
  - [ ] **KBART** — builder + test exist but **route always returns HTTP 500** ("Authentication required." from a synthetic `new Request('http://localhost')`, live-verified). Endpoint non-functional since creation.
  - [~] **ROR** — proxy deployed + tests; **0 UI callers** (unwired).
  - [~] **ORCID** — public lookup proxy only (no OAuth/verified records/sync), **0 UI callers**; its route test is excluded from vitest config.
- Reconciled with `docs/current-dspace-comparison.md` §10 and `docs/production-maturity-matrix.md`.

### WAVE 6 — Enterprise maturity — **AUDIT VERDICT 2026-09-28: PARTIAL (was wrongly marked "All complete")**
- [~] **Report writer** — 5 canned types, PostgREST-only (SQLi-immutable by design), CSV/JSON + tests. **But: `/api/admin/reports/generate` has 0 UI callers, scheduling is a local-state toggle only, and the serials branch queries a nonexistent `end_date` column (runtime error if called)**. STATUS: PARTIAL.
- [ ] **COUNTER** — builder + test exist, **display unwired** → LEVEL 1. **SUSHI — endpoint does not exist** → LEVEL 0. "Complete" was FALSE.
- [ ] **Multilingual** — `src/lib/i18n.ts` (en/fr) has **zero page callers**, no language switcher → architecture only. "Complete" was FALSE.
- [~] **Accessibility** — ~83 `aria-*` attributes + policy page, but **no automated a11y tests/audit** (no axe/playwright). STATUS: PARTIAL.
- [~] **API docs** — `docs/api.md` documents **23 of 82 route files**; no OpenAPI spec. STATUS: PARTIAL. (`docs/standards-conformance.md` referenced by audits **does not exist**.)
- [~] **Backups/DR** — backup scripts exist; **DB storage objects (buckets) not covered by backup**. STATUS: PARTIAL.
- [~] **Observability** — logger/redaction/metrics code exists but **`/metrics` is an unwired dead route**. STATUS: PARTIAL.
- [~] **Security hardening** — real work landed (RBAC, RLS 125/125, rate limits) but audit found new P0s: COAR open inbox, KBART 500, public buckets vs embargo, SIP2 auth bug, `npm audit` 22 vulns (1 critical), no CI gate. STATUS: PARTIAL.
- [x] **Performance testing** — `docs/performance-test-results.md` (10 endpoints, 100% success, avg 209ms) exists; this audit added live p50/p95 (p50 ≈ 280–430ms, p95 ≈ 450–620ms incl. internet RTT) but **no large-scale fixtures** (100k records etc. remain untested — see `docs/competitive-position-2026.md` Section J notes in `docs/production-maturity-matrix.md`).
- Reconciled with `docs/top-remaining-gaps.md`.

### Definition of Done gate (each wave)
migrations applied · vitest passes · tsc = 64 baseline (or better) · lint · build · docs updated · commit logically.

## Migration state

- 55 timestamped SQL files, `20260620202651…` → `20260926160000…`; applied manually/ad-hoc to hosted Supabase (no `db push` script; `docker/postgres/init-migrations.sh` orphaned).
- Hosted DB: `rnnjspkdhojoigncdgmy`; live schema verified via ad-hoc psql — **AUDIT 2026-09-28 re-verified: 125 tables, 125 RLS-enabled, 0 tables without RLS, 0 policy-less RLS tables, 327 indexes** (supersedes the earlier 121/116 figure).
- PENDING migration (from audit): canonical repo model changes; event tables; FTS wiring.
- Safety: every migration must be idempotent (`IF NOT EXISTS` guards, existing convention) + have rollback notes in the commit message.

## Tests

- Vitest: **141 / 43 files** passing as of `2625abb` (0 failed, 0 skipped). **Caveat: `vitest.config.ts` include is `['src/**/*.test.ts','worker/**/*.test.ts']`, so the 6 route tests under `app/api/**` (oai, sru, orcid, authorities, licenses, offline-sync) NEVER RUN in the configured suite** — fixed-priority (backlog P0 #5).
- tsc: baseline **64 errors** — new code must not add to it (`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`). Verified: WAVE 0 commit added 0 new errors (64 on commit `1790c11`); audit re-run 2026-09-28 = **64 total** (0 in new-wave dirs; ~63 from one `as const` pattern; build only passes because `next.config.mjs` sets `ignoreBuildErrors:true`).
- E2E smoke suites (temp, not committed): `C:\Users\LENOVO\AppData\Local\Temp\opencode\{reg-e2e.mjs, verify-rate-limit.mjs, email-live.mjs}`.
- No headless browser available → no browser-level UI tests.

## Configuration required / external dependencies

- **Owner action**: verify sending domain at resend.com/domains (or change `FROM_EMAIL`) — currently all mail rides Gmail SMTP fallback (≈500/day cap).
- Owner: provide `ARCJET_KEY` and/or Turnstile keys to re-enable middleware protections (both inert today).
- Owner: rotate DB password after removing `check_jobs.js`/`check_schema.js` credentials.
- Optional: `ZENODO_TOKEN` (DOI minting), `CORE_API_KEY` (CORE adapter returns `[]` without it), `AI_GATEWAY_API_KEY` (AI librarian edge fn).
- No fabricated secrets: external-integration code marked "CODE COMPLETE — AWAITING CREDENTIALS" where applicable.

## Known issues (open, from issues-to-fix.md + audit)

- #3 ILL submit · #5 labels/3D overflow · #9 repo header · #11 news dates · #12 researchers page · #13 hold checkout · #14 barcode · #15 stats · #16 duplicate staging · #17/18 harvest · #19 AI agent workers · #21 Take-A-Break extras.
- `GlobalSearch.tsx` hard-coded empty tabs; "Coming Soon" pages (`FacultyLibraries.tsx:95`, `LibraryBranch.tsx:642`).
- `docs/features-by-role-and-benchmark.md` + `next-prompt.md` untracked (owner has not decided).
- ~~Parity matrix claim "OAI-PMH Complete" is false until WAVE 1 lands~~ — WAVE 1 landed; OAI-PMH live-verified (`docs/interoperability/oai-pmh.md`).

## Fixed 2026-09-28 (accreditation readiness)

- **Catalogue "[object Object]" titles** — `CatalogueCard` now coerces title to string (`typeof item.title === 'string' ? item.title : ...`). Committed `d426bd8`, deployed.
- **Dashboard Sign Out menu** — `DashboardLayout` top bar now has user dropdown (My Dashboard, My Profile, Settings, Sign Out). Committed `d426bd8`, deployed.
- **Admin login credentials** — passwords reset for `admin@esut.edu.ng` (`ESUT@Admin2026!`), `librarian@esut.edu.ng` (`ESUT@Lib2026!`), `cataloguer@esut.edu.ng` (`ESUT@Cat2026!`). Verified via Supabase Auth API: all three return access tokens.

## Fixed 2026-09-28 (approvals nav + 2 red tests)

- **Approvals missing from admin menu** — the `/admin/approvals` route existed under `AdminLayout` (`src/App.tsx:242`) but had **no sidebar entry** in `adminNav` (`src/components/layout/AdminLayout.tsx`); only the patron dashboard footer linked it. Added **Patrons → Approvals** (gated by the `approvals` feature via `roleCan`) and **Approve Registrations** quick action on the admin dashboard. Committed `dfb36f9`, deployed `CUTOVER_OK`, live-verified (health 200, `/api/admin/approvals` 401 unauthenticated = exists + auth-gated).
- **SIP2 spec bug** — `buildSip2Response` computed the CRC over `message + 'AZ'` but never appended the literal `AZ` tag, so responses ended in 4 bare hex digits (`src/server/sip2/messages.ts:31`). Fixed: `message + 'AZ' + checksum + '\r'`.
- **AIP test was vacuous** — `aipExport.test.ts` asserted a hand-written fixture `'abc123'` had length 64 (impossible, always failed). Rewrote to hash real bytes with `computeChecksum` and assert `/^[0-9a-f]{64}$/`.
- Gates after fixes: tsc **64** (baseline), vitest **133/133 (42 files)**, `next build` exit **0**, resource checks **18/18**.

## Fixed 2026-09-28 (Analytics 401 + directory database management)

- **Analytics "Authentication required" 401** — `src/app-pages/admin/Analytics.tsx` called `/api/admin/analytics` without a Bearer token (`requireRole` needs it; the admin route is not in middleware `sensitivePrefixes`). Now fetches the Supabase session token via `supabase.auth.getSession()` and sends `Authorization: Bearer …` (with a cancelled-flag effect). Sweep confirmed Analytics was the only offender (LibraryManual, ContentEngine, Harvest already attach tokens). Live-verified: authenticated `GET /api/admin/analytics?days=30` → **200 success**.
- **Open Access / Subscribed Databases admin management** — the two public pages (`/open-access-databases`, `/subscribed-databases`) were static-config-only with no admin editing. Added an **overlay pattern**: shipped config (`src/config/openAccessDatabases.data.ts` 117 entries, `subscribedDatabases.data.ts` 7) is the base; rows in new table `directory_databases` (migration `20260928070000`, RLS enabled + public-read policy — applied and verified on hosted DB) with the same `(id, directory)` replace or hide (soft-hide) static entries; new ids are custom entries.
  - `src/server/directory/directory.ts` — merge/CRUD module (+8 unit tests); `app/api/directory/route.ts` (public read), `app/api/admin/directory/route.ts` (GET/POST/PATCH/DELETE behind `requireRole(LIBRARY_ADMIN_ROLES)`).
  - `src/app-pages/admin/DirectoryDatabases.tsx` — shared admin UI (list/search/create/edit/hide/show/delete, source+status badges, View Public Page); routed at `/admin/open-access-databases` and `/admin/subscribed-databases` (`src/App.tsx`, lazy); sidebar entries under Collections in `AdminLayout.tsx`.
  - Public pages now render from `GET /api/directory` with static-config fallback.
- **Stale public directory data (production bug found during live E2E)** — after creating a custom entry, the admin API showed 118 but the public API kept returning 117: the supabase REST `fetch` inside `getSupabaseAdminClient().pinnedFetch` was served from Next.js Data Cache in the public route segment (`export const dynamic = 'force-dynamic'` alone did not prevent it; local dev returned fresh 118). Fixed in `df7b165`: `cache: 'no-store'` on all pinnedFetch calls, `fetchCache = 'force-no-store'` + `Cache-Control: no-store` on the public route, and `console.error` logging in `getPublicDirectory`'s fallback catch.
- **Live E2E proof** (admin login → API): create custom entry → public **118**; delete → public **117**, admin **117**, `directory_databases` empty; unauthenticated admin route → **401**; `/api/directory?directory=bogus` → **400**.
- Commits: `ee27bd8` (feature + Analytics fix), `df7b165` (no-store fix), docs commit after this update; both deploys `CUTOVER_OK`.
- Gates: tsc **64** (baseline), vitest **141/141 (43 files)**, `next build` exit **0**, resource checks **18/18**.

## Competitive audit 2026-09-28 (`post-implementation-prompt.md`) — "All Waves 0–6 Complete" VERIFIED

Fresh evidence-based audit vs **Koha 26.05.03** and **DSpace 10.0**, commit `2625abb`. Deliverables:

- `docs/current-koha-comparison.md` — 25-domain matrix, 8 columns, per-capability AHEAD/PARITY/BEHIND/PARTIAL/UNVERIFIED.
- `docs/current-dspace-comparison.md` — 30-domain matrix, same format.
- `docs/competitive-position-2026.md` — executive summary (ahead/parity/behind both, combined-capability claims, unproven features, new gaps, debt, priorities).
- `docs/top-remaining-gaps.md` — prioritized backlog P0–P3 (feature/competitor/state/gap/reason/impact/deps/implementation).
- `docs/production-maturity-matrix.md` — feature × (implemented/tests/deployed/external-tested/production-usage) with LEVEL 0–5.

**Audit verdict on this file's wave claims:** the blanket "All Waves Complete" statement was **not accurate** and has been corrected in place above:

| Wave | Corrected verdict |
|---|---|
| WAVE 0 | COMPLETE (3 open items intentionally left `[ ]`) |
| WAVE 1 | PARTIAL — object model still open; OAI code-complete but externally unverified (0 records, excluded route test, embargo filter gap); analytics capture unwired; RepositoryStats fix open |
| WAVE 2 | PARTIAL — fixity not scheduled; AIP is a pseudo-bag without payload/no route; versioning v1-only with placeholder test |
| WAVE 3 | PARTIAL — MARC export-only with 0 production callers; Z39.50 honestly relabelled but protocol still absent; SRU has no CQL |
| WAVE 4 | **NOT COMPLETE** (was marked all-complete): POS absent, multi-currency absent, SIP2 has no flag+no listener+weak auth, EDI generate-only, KBART route 500, notices unwired |
| WAVE 5 | PARTIAL — Signposting/ResourceSync/OpenURL unwired (were labeled "Deployed"), KBART 500, COAR unauthenticated (P0), ORCID/ROR unwired |
| WAVE 6 | **NOT COMPLETE** (was marked all-complete): COUNTER unwired/SUSHI absent, i18n unwired, api.md 23/82, lint not runnable, metrics dead route, security P0s open |

**Position summary:** ESUT is **behind Koha in every core ILS depth domain** and **behind DSpace in every core IR domain**; its genuine advantages are scope-based (ILS+IR+CRIS+AI+engagement in one deployment) and currently weakened by owner-reported production defects (#3/#4/#13/#14/#19). **No feature reached LEVEL 5 (external interoperability) in this audit.**

**New P0s discovered:** KBART 500 · COAR inbox anonymous 201 · public buckets vs embargo · SIP2 non-blank password auth · no CI test/tsc gate + `ignoreBuildErrors:true` · Next.js critical npm advisories · worker failures (#19).

**Final gate results (this audit):** tsc **64 total errors** · vitest **141 passed / 0 failed / 0 skipped / 43 files** (6 route tests excluded by config) · `next build` exit **0** · lint **not runnable (no config)** · `npm audit --omit=dev` **22 (1 critical, 8 high, 10 moderate, 3 low)** · hosted DB **125 tables, 125 RLS, 0 policy-less, 327 indexes** · containers `esut-app-new` healthy / `esut-worker` up · live probes: 7 endpoints 200 (p50 ≈ 280–430ms, p95 ≈ 450–620ms incl. RTT), KBART 500, COAR 201 unauth.
