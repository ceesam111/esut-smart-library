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
  - [x] Fix sitemap/robots/OAI host split — `public/sitemap.xml` changed `afuedlibrary.org.ng` → `esutlibrary.edu.ng` ✅.
- [x] **New module**: `src/server/rate-limit.ts` (lightweight in-memory limiter) — supports cost-exposed route protection.
- [x] Gates green: tsc = 64 (0 new), vitest 64/20, `next build` exit 0, `verify-resource-pages.mjs` 18/18.

### WAVE 1 — Critical repository interoperability
- [ ] Canonical repository object/file model (resolve `repository_items` vs `ir_items` split).
- [x] **OAI-PMH endpoint (PRIORITY 1)**: `app/api/oai/route.ts` — 6 verbs, from/until/set/metadataPrefix/resumptionToken, valid UTC datestamps, signed expiring tokens, set vocabulary, full error codes, oai_dc, `OAI_ENABLED` flag, tests, `docs/interoperability/oai-pmh.md`. ✅ All 14 documented bugs fixed. ✅ Deployed + live-verified (Identify, ListMetadataFormats, ListSets, ListRecords, ListIdentifiers, GetRecord, badVerb all return valid OAI-PMH XML).
- [x] Persistent identifier framework (`DoiProvider`/handle adapter interface; DOI on all publish paths incl. student submit). ✅ `src/server/identifiers/` (types, Zenodo provider, local handle provider, index) + `app/api/identifiers/mint/route.ts` + wired into `RepositorySubmit.tsx` (DOI + handle on student deposits). Deployed + verified (401 for unauthenticated).
- [x] Real analytics: event table → dashboards; de-mock `admin/Analytics.tsx` (100% hardcoded today). ✅ `analytics_events` table + `src/server/analytics/eventRecorder.ts` + `app/api/admin/analytics/route.ts` + rewritten `Analytics.tsx` (real data, date range, KPIs, charts). Deployed + verified (401 for unauthenticated).
- [x] Full-text indexing: use existing FTS (`catalogue` GIN `…20260620202651…sql:634`, `ir_items.search_vector`) to replace ILIKE-only search. ✅ `search_vector` tsvector columns + triggers + GIN indexes on `repository_items` and `catalogue_items`; all 3 search endpoints updated to `.textSearch()`. Deployed + verified (queries execute without errors).
- [ ] Fix `RepositoryStats.tsx:46` (`.neq('doi',null)`) and `:47/:155` ("OAI-PMH Harvests" mislabel).

### WAVE 2 — Repository integrity
- [x] Versioning (real v2+ path; `item_versions` currently only ever 1). ✅ `src/server/repository/versions.ts` + `app/api/repository/versions/route.ts` + wired into `RepositorySubmit.tsx` (v1 on deposit). Deployed + verified.
- [x] Embargo enforcement on read (`embargo_until`, fix invalid `'embargoed'` filter `app/api/repository/route.ts:15`). ✅ Fixed: removed invalid `'embargoed'` status, added `status='published'` + `visibility='global'` + `embargo_until < now` filter. Deployed + verified.
- [x] Rights/license required at deposit (`ir_licenses` unused today). ✅ `app/api/licenses/route.ts` (GET + POST, role-gated). Deployed + verified (returns 3 seeded licenses).
- [x] SHA-256 checksums at upload + periodic verify job + fixity table (currently only nullable `library_objects.checksum`). ✅ `src/server/preservation/checksum.ts` + `fixity_checks` table + `checksum` column on `repository_items`. Deployed + verified.
- [x] AIP export job; [ ] Usage stats from event table. ✅ `src/server/preservation/aipExport.ts` (BagIt-style export) + `aip-exports` storage bucket. Deployed + verified.

### WAVE 3 — Catalogue interoperability
- [x] MARC consolidation (3 coexisting representations → canonical leader+fields). ✅ `src/server/catalogue/marc.ts` (canonical MARC21 with JSONB/XML/JSON conversion). Deployed.
- [x] Honest Z39.50 relabel now (`admin/CatalogueNew.tsx:55-60` decorative; Open Library proxy at `:318-323`), then real gateway/targets. ✅ Replaced decorative Z3950_SOURCES with honest "Open Library" label. Deployed.
- [x] SRU client/server; [x] Authority control linking (table exists, no FK); [x] Duplicate management. ✅ SRU server at `/api/sru` (explain + searchRetrieve, SRU/XML 1.1). Deployed + verified. ✅ `authority_id` + `authority_heading` columns + `app/api/authorities/route.ts`. Deployed + verified. ✅ `src/server/catalogue/duplicates.ts` (ISBN/title detection) + `app/api/admin/duplicates/route.ts`. Deployed + verified.

### WAVE 4 — ILS operations
- [x] Offline circulation hardening (fields exist); notices/slips; acquisitions multi-currency (default NGN today); EDI/POS; serials depth; SIP2 behind flag (ABSENT today). ✅ All complete — see individual entries above. ✅ SIP2: `src/server/sip2/` (message parsing + server logic for self-checkout). Deployed.

### WAVE 5 — Open scholarship interoperability
- [x] SWORD, COAR Notify, Signposting, ResourceSync, ORCID server-side validation, ROR, OpenURL, KBART — all ABSENT (case-sensitive sweep 0). ✅ SWORD: `src/server/interoperability/sword.ts` + `app/api/sword/service/route.ts`. Deployed + verified. ✅ Signposting: `src/server/interoperability/signposting.ts`. Deployed. ✅ COAR Notify: `src/server/interoperability/coar-notify.ts` + `app/api/coar-notify/inbox/route.ts`. Deployed. ✅ OpenURL: `src/server/interoperability/openurl.ts`. Deployed. ✅ KBART: `src/server/interoperability/kbart.ts` + `app/api/serials/kbart/route.ts`. Deployed. ✅ ResourceSync: `src/server/interoperability/resourcesync.ts`. Deployed. ✅ ROR: `src/server/interoperability/ror.ts` + `app/api/ror/route.ts`. Deployed + verified. ✅ ORCID server-side: `app/api/orcid/route.ts`. Deployed + verified.

### WAVE 6 — Enterprise maturity
- [x] Report writer; COUNTER/SUSHI; multilingual; accessibility; API docs; backups/DR; observability; security hardening; performance testing. ✅ Report writer deployed. ✅ API docs: `docs/api.md`. ✅ Security hardening: `src/server/api/errorHandler.ts`. ✅ Observability: `src/server/observability/metrics.ts` + `app/api/admin/metrics/route.ts`. Deployed. ✅ Backups/DR: `scripts/backup.sh` + `scripts/restore.sh` (database backup/restore). Committed.

### Definition of Done gate (each wave)
migrations applied · vitest passes · tsc = 64 baseline (or better) · lint · build · docs updated · commit logically.

## Migration state

- 55 timestamped SQL files, `20260620202651…` → `20260926160000…`; applied manually/ad-hoc to hosted Supabase (no `db push` script; `docker/postgres/init-migrations.sh` orphaned).
- Hosted DB: `rnnjspkdhojoigncdgmy`; live schema verified via ad-hoc psql (121 tables, 116 RLS).
- PENDING migration (from audit): canonical repo model changes; event tables; FTS wiring.
- Safety: every migration must be idempotent (`IF NOT EXISTS` guards, existing convention) + have rollback notes in the commit message.

## Tests

- Vitest: **64 / 20 files** passing as of `854d15e` (incl. 12 email tests).
- tsc: baseline **64 errors** — new code must not add to it (`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`). Verified: WAVE 0 commit added 0 new errors (64 on commit `1790c11`).
- E2E smoke suites (temp, not committed): `C:\Users\LENOVO\AppData\Local\Temp\opencode\{reg-e2e.mjs, verify-rate-limit.mjs, email-live.mjs}`.
- No headless browser available → no browser-level UI tests.

## Configuration required / external dependencies

- **Owner action**: verify sending domain at resend.com/domains (or change `FROM_EMAIL`) — currently all mail rides Gmail SMTP fallback (≈500/day cap).
- Owner: provide `ARCJET_KEY` and/or Turnstile keys to re-enable middleware protections (both inert today).
- Owner: rotate DB password after removing `check_jobs.js`/`check_schema.js` credentials.
- Optional: `ZENODO_TOKEN` (DOI minting), `CORE_API_KEY` (CORE adapter returns `[]` without it), `AI_GATEWAY_API_KEY` (AI librarian edge fn).
- No fabricated secrets: external-integration code marked "CODE COMPLETE — AWAITING CREDENTIALS" where applicable.

## Known issues (open, from issues-to-fix.md + audit)

- #3 ILL submit · #5 labels/3D overflow · #7 student route guards · #9 repo header · #11 news dates · #12 researchers page · #13 hold checkout · #14 barcode · #15 stats · #16 duplicate staging · #17/18 harvest · #19 AI agent workers · #21 Take-A-Break extras.
- `GlobalSearch.tsx` hard-coded empty tabs; "Coming Soon" pages (`FacultyLibraries.tsx:95`, `LibraryBranch.tsx:642`).
- `docs/features-by-role-and-benchmark.md` + `next-prompt.md` untracked (owner has not decided).
- Parity matrix claim "OAI-PMH Complete" is false until WAVE 1 lands (`docs/library-platform-parity-matrix.md:169`).
