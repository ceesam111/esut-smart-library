# ESUT Smart Library — Platform Audit

Phase 0 / first deliverable required by `next-prompt.md`.
Method: read-only repository inspection (5 explore passes + targeted greps).
Base commit: `854d15e`. Generated: 2026-09-27. Live target: `virtuallibrary.esut.edu.ng`.

**Status legend** — `IMPLEMENTED` real server-side behavior with evidence · `PARTIAL` some real pieces · `MOCKED` UI/label only, no real backing · `BROKEN` exists but fails or is unreachable · `ABSENT` no code · `DEPRECATED` superseded/dead code present · `UNKNOWN` cannot be verified from the repo.

**Rule applied (next-prompt.md):** a column, button, page, interface, dummy JSON or demo number is NOT a feature.

---

## Part I — First Deliverable (13 required items)

### 1. Detected architecture

| Layer | Finding | Evidence |
|---|---|---|
| Framework | Next.js 14.2.35 App Router used as API/meta shell; UI is a React Router SPA | `package.json`; `src/App.tsx` |
| Frontend | Live pages = `src/app-pages/**`; `src/views/**` is DEAD (excluded from compilation) | `tsconfig.json:54`, aliases `tsconfig.json:29-31` |
| Backend | 61 `route.ts` API handlers: 42 authenticated, 19 unauthenticated (incl. 4 open mutating routes) | `app/api/**` inventory |
| Language / PM | TypeScript, npm (npx blocked by PS policy; scripts run via `node node_modules/...`) | `package.json` |
| ORM | None — direct PostgREST via `supabase-js` | `src/integrations/supabase` |
| Database | Hosted Supabase Postgres (`rnnjspkdhojoigncdgmy`) | `.env.local` |
| Auth | Supabase Auth + server helpers `requireUser`/`requireRole` | `src/server/**` |
| Middleware | Arcjet (key ABSENT in env → inactive), dev rate limit, cookie CSRF | `middleware.ts:10,43,48-52,58-72,124-141` |
| Email | Central service: Resend HTTP primary + Gmail SMTP fallback | `src/server/email/**` |
| Logging | Winston with redaction + child loggers | `src/server/logging/logger.ts:12,42,49` |
| Caching | Effectively ABSENT — only `Cache-Control` on TTS audio | `app/api/ai/lyria-voice/route.ts:76,100` |
| Rate limiting | Middleware `devRateLimit` + per-route in-memory Maps (discovery 20/hr `src/server/resources/rateLimit.ts:4-15`, email gateway limiter) | see files |
| Deployment | VPS Docker: `docker-compose.prod.yml` runs `app` + `worker`; shell deploy scripts swap `esut-app-new` / `esut-worker` | `docker-compose.prod.yml:2,42-70` |
| Observability | Health endpoints only (`/api/health/schema`, worker health proxy); no APM/metrics/tracing | `app/api/health/schema/route.ts:7-21` |

### 2. Actual current database schema

- **121 DDL tables** across 55 timestamped migrations (`20260620202651…` → `20260926160000…`).
- **120 tables queried** by app code; **13 DDL-only** (never queried); **11 queried names have no DDL** (legacy `src/views` dead code, e.g. `ill_tickets`, `analytics_network`).
- **RLS: 116/121 tables** have RLS + ≥1 policy (432 policies). **0** tables have a policy without RLS. **5 tables have NO RLS/policies at all**: `ir_items`, `ir_licenses`, `ir_embargo_logs`, `ir_audit_logs`, `catalog_audit_logs` — all created in `supabase/migrations/20260705120000_catalog_ir_separation.sql:6,33,43,54,64` (file contains zero `row level security`/`create policy`/`grant`) — **CRITICAL**.
- Permissive leftovers: `item_versions` `using (true)` (`20260620202944…sql:230-234`), `report_snapshots` `for all using(true) with check(true)` (`:568`), plus `thesis_supervisors/workflow`, `course_reading_list_items`, `harvest_log`, `academic_calendar` `using(true)`.
- **Generated types are stale**: `src/integrations/supabase/types.ts` knows 99 of 121 tables (missing `issn`, `handle`, `license`, all `agent_*`, `library_objects`, `ir_*`, `resource_*`).
- **Migration framework: PARTIAL** — no `supabase db push`/migrate script (`package.json:9-21`); orphaned runner `docker/postgres/init-migrations.sh:4-7` (no postgres service in any compose file); ad-hoc psql scripts with hardcoded DSNs (`scripts/apply-cols.sh:3,5` etc., untracked); stale docs (`DATABASE_MIGRATION.md:5-11`).
- Domain inventory: catalogue 13 · patrons 7 · circulation 8 · repository/CRIS 19 · acquisitions 6 · serials 5 · requests/ILL 5 · CMS/engagement 27 · auth/roles 7 · audit 5 · analytics/events 11 · notifications 3 · worker/jobs 8 · settings/misc 5.

### 3. Current search architecture

- **App-level search is `ILIKE` only.** Zero `textSearch`/`tsquery` calls in any `.ts/.tsx`. Evidence: `app/api/catalog/route.ts:18`, `app/api/repository/route.ts:18`, `app/api/search/resources/route.ts:74,102`.
- FTS exists in DB but is unused: GIN `tsvector` on catalogue title (`20260620202651…sql:634`), newspaper titles (`…20260620232229…sql:127`), and a maintained `ir_items.search_vector` (`20260705120000…sql:28,74,85-103`) — the latter is dead weight because the app never queries `ir_items`.
- External discovery is REAL: `app/api/search/resources/route.ts` → 14 live adapters (`src/server/resources/adapters.ts:26-442`, registry `:444`) → staging/approval → upsert into `catalogue_items`. Callers: `GlobalSearch.tsx:256,273`, `Catalogue.tsx:169`.
- Orphan edge functions with zero call sites: `supabase/functions/federated-search/index.ts` (563 lines), `supabase/functions/ebook-search/index.ts` — **DEPRECATED**.

### 4. Background-worker architecture

- **IMPLEMENTED**: `worker/` (21 files) — `index.ts`, `runner.ts`, `scheduler.ts:14-46`, `health.ts`, `retry.ts`; **10 job handlers** registered (`worker/handlers/index.ts:10-21`): catalogue.enrich, resources.harvest, resources.downloadToB2, repository.extractMetadata, communications.draftNewsletter, reports.weeklyTenantReport, system.healthCheck, circulation.overdueReminders, circulation.sendOverdueEmails, circulation.sendDueSoonEmails.
- Runs as separate container (`Dockerfile.worker`, `docker-compose.prod.yml:42-70`) and locally via `npm run worker`. Deployed + healthy on VPS (`esut-worker`, `WORKER_OK`).
- **Gaps**: base `docker-compose.yml`/`docker-compose.dev.yml` contain only `app` (worker absent in dev); admin jobs API whitelists only **8** of 10 job types (`app/api/admin/agents/jobs/route.ts:9-18` — `circulation.sendOverdueEmails` and `circulation.sendDueSoonEmails` missing → unmanageable from admin UI/API).

### 5. Storage architecture

- Supabase Storage buckets `repository` + `theses`: public, 100 MB, PDF-only (`20260630110000_storage_buckets_repository_theses.sql:1-8`), used by `RepositorySubmit.tsx:159-166`, `IrDeposit.tsx:62-63`.
- Parallel Backblaze B2 path: `library_objects` table + signed upload/download (`app/api/admin/storage/b2/signed-upload/route.ts`, `signed-download/route.ts`, `src/server/storage/libraryObjects.ts:22-93`); B2 adapter tested with mock S3 client (`b2Client.test.ts:37`).
- **Checksum/fixity: ABSENT except one nullable column** — `library_objects.checksum` (`20260626103000…sql:11`), written at signed upload (`signed-upload/route.ts:12`). No checksum on `repository_items`/`theses`/`ir_items`; no periodic verification job → digital preservation is NOT implemented.
- PDF processing: `repository.extractMetadata` worker handler (`worker/handlers/repository.ts:8`); no full-text PDF indexing. Upload pipeline = client → Supabase Storage/B2 → row update; no virus scanning (ABSENT).

### 6. Current authentication / RBAC

- Supabase Auth sessions; server-side `requireUser` / `requireRole(GLOBAL_ADMIN_ROLES)` on protected routes; client session probe in `src/lib/email.ts`.
- Role model aligned: `public.app_role` enum = 10 values (`20260926140000_app_role_alignment_enum.sql:11-13`); server `FoundationRole` = 10; front-end `AppRole` = 10.
- **Dual role system (HIGH)**: `user_roles.app_role` (`20260620221721…sql:8`) vs parallel `librarians` table (`20260620202651…sql:647`) with late enum drift; `is_library_staff` redefined later (`20260926140100…sql:8`).
- Route exposure: 19 unauthenticated routes including **4 open mutating** routes (identified in architecture pass) — part of WAVE 0 permissions review.
- CSRF: cookie/header check in `middleware.ts:102-125`, **exempting `/api/ai/`, `/api/security/turnstile/`, `/api/registration/`** (`middleware.ts:7`).
- Turnstile: **DISABLED stub** — `src/server/security/turnstile.ts:20-23` returns `{success:true, skipped:true}` with no Cloudflare call (`app/api/security/turnstile/verify/route.ts:2,9` also always succeeds).
- Arcjet: configured but **no `ARCJET_KEY` in environment** → inactive; only `sensitivePrefixes` (`middleware.ts:5`) hit `devRateLimit`/Arcjet, so most routes are unthrottled in production.

### 7. Current catalogue architecture

- **IMPLEMENTED**: `catalogue_items` (bibliographic, `20260620202651…sql:30-51`) + `catalogue_copies` (holdings, barcode unique, `:766-778`) + staging/import pipeline (`20260625152000_catalogue_csv_import.sql:13,29`; `src/server/catalogue/stageImport.ts:26,55,74`, `approveStagedRow.ts:13,18,60`).
- MARC: **three representations** — `marc21 jsonb` (`:47`), `marc21_leader`+`marc21_fields` (`:763-764`), loose fields (`:756-762`); MARC XML export `admin/Catalogue.tsx:374-404`; MARC edit UI `admin/CatalogueNew.tsx:457,484`. Not full MARC21 interoperability (no Z39.50/SRU server).
- Authority file `authority_control` exists with live CRUD (`20260620204347…sql:66-83`; `admin/CatalogueAuthorities.tsx:54-146`) but **no FK/link from catalogue_items** → unlinked authority control.
- Z39.50 client: **MOCKED** — `Z3950_SOURCES` (`admin/CatalogueNew.tsx:55-60`) is decorative; search actually calls Open Library (`:318-323`); source selection never affects the request; logs go to `z3950_imports` mislabeled (`:495-497`). **SRU: ABSENT** (0 matches). Z39.50 server/gateway: ABSENT.
- Enrichment real: `src/server/catalogue/enrichCatalogue.ts:24-25,98` (Open Library ISBN), edge `enrich-catalogue`.

### 8. Current repository architecture

- **Two competing models**: `repository_items` (all live code) vs `ir_items` (only `scripts/migrate-catalog-ir.ts:44`).
- **BROKEN (HIGH)**: `admin/IrDeposit.tsx:74-92` inserts `faculty`, `date_issued`, `file_paths`, `deposit_date`, `depositor_id` into `repository_items` — those columns exist only on `ir_items` (`20260705120000…sql:15-26`) → insert fails at runtime.
- **Status mismatch**: `app/api/repository/route.ts:15` filters `status='embargoed'`, a value legal only for `ir_items.status` (`…sql:27`), never produced for `repository_items` (allowed: `submitted/review/approved/published/rejected`, `…sql:103`).
- DOI: column populated by admin deposit and Zenodo publish (`zenodo-publish/index.ts:119-127`); **student submit never sets DOI** (`RepositorySubmit.tsx:181-200`); no DataCite/Crossref registration code → **PARTIAL (minting = Zenodo-only, needs `ZENODO_TOKEN`)**.
- Handle: local mint `esutir/{year}/{id}` (`src/lib/moduleSeparation.ts:34`) + column (`…20260925120000…sql:4`); **no handle.net registration** → PARTIAL (local-only).
- Versioning: `item_versions` table (`20260620202944…sql:221-228`), read in `RepositoryItem.tsx:92`, but only writer is `zenodo-publish/index.ts:130-135` always `version_number: 1` → **BROKEN (no v2+ path)**.
- Embargo: `embargo_until` column set by submit/deposit UIs, but **not enforced on read** (public list exposes items and file URLs regardless) → enforcement ABSENT (WAVE 2).
- OAI-PMH: see Part II §A — **BROKEN/UNREACHABLE**.

### 9. Current acquisitions / circulation architecture

- **Circulation IMPLEMENTED**: `loans`, `loan_fines`, `fines`, `reservations`, `payments`, `course_reserves`, `circulation_transactions` (offline sync fields `offline_id, synced_at`, `20260620204347…sql:86-98`); server rules `get_circulation_rules()`, `calculate_loan_fine()`, request workflow functions (`20260711161000…sql:34-206`); live admin UI `admin/Circulation.tsx` (182-413), `admin/Requests.tsx:109`; worker overdue/due-soon email handlers.
- **Acquisitions IMPLEMENTED**: supplier → recommendation → PO → line item → invoice → budget chain (`20260620202651…sql:837-974`, indexes `:1058-1063`, RLS `:851-982`); live `admin/Acquisitions.tsx`.
- **Serials/newspapers IMPLEMENTED**: `serials_subscriptions/issues/routing`, `newspaper_serials/articles` (`…sql:984-1038`, `…20260620232229…sql:2,69`); live `admin/Serials.tsx`, `admin/NewspaperIndex.tsx:385`.
- **Requests/ILL PARTIAL**: `ill_requests`, `resource_requests`, `database_access_requests`, `suggestions` exist; `ill_tickets` queried with **no DDL**; known open defect = ILL submit flow (issues-to-fix #3).
- SIP2/EDI/POS/multi-currency: **ABSENT** (0 matches for SIP2; PO currency hard default `NGN`, `…sql:896`).

### 10. Current analytics implementation

- **Admin Analytics page = MOCKED 100%**: `src/app-pages/admin/Analytics.tsx` imports no data source (`:1-15`); hardcoded `lineData :17-25`, `donutData :27-32`, `searchData :34-45`, `getVisitsData()` identical constants for every range (`:54-65`), `newRegistrations :68-76`, static delta labels `:144,150,162`, branch statistics `:259-271`, resource performance table `:304-340`; search box `:52/:286` filters nothing.
- **RepositoryStats = IMPLEMENTED but buggy**: real queries (`RepositoryStats.tsx:44-120`); `:46` `.neq('doi', null)` never matches (PostgREST) → "DOIs Assigned" always 0 (should be `.not('doi','is',null)`); `:47/:155` KPI labeled **"OAI-PMH Harvests"** actually counts `harvest_log` rows → mislabeled, no OAI telemetry exists.
- **Reports = PARTIAL**: 7 live counts + snapshot save + CSV export (`admin/Reports.tsx:85-139,203-233`); monthly email schedule is local state never persisted (`:73,292-296`); Operational Reports tab renders placeholder (`:508-520`).
- **No page-view/event-tracking table** — only ad-hoc counters (`view_count/download_count`); `webometrics_stats` DDL exists but never queried; **COUNTER/SUSHI: ABSENT (0 matches)**.
- Audit trail: 5 audit tables (`audit_logs`, `admin_access_log`, `role_audit_log`, `ir_audit_logs`, `catalog_audit_logs`) — the last two have no RLS (see §2).

### 11. File-and-line evidence for previously reported gaps

| Reported gap | Evidence |
|---|---|
| OAI-PMH "Complete" claim is wrong | `docs/library-platform-parity-matrix.md:169` vs Part II §A (endpoint 404, edge fn unconfigured) |
| Z39.50 sources decorative | `admin/CatalogueNew.tsx:55-60` vs actual Open Library call `:318-323` |
| Admin analytics fake numbers | `admin/Analytics.tsx:17-76,144-340` |
| Student route guard missing | `src/App.tsx:234-235` (no `FeatureRoute`) — issues-to-fix #7 |
| ILL submit broken | issues-to-fix #3; `ill_tickets` has no DDL |
| GlobalSearch empty tabs | `GlobalSearch.tsx` hard-coded empty tab config |
| Build ignores type/lint errors | `next.config.mjs` `ignoreBuildErrors:true`, `ignoreDuringBuilds:true` |
| Turnstile disabled pending keys | `src/server/security/turnstile.ts:20-23` |
| `src/views` dead code | `tsconfig.json:54`; 10 legacy tables queried only from there |
| 3D/labels overflow, hold checkout, barcode, stats, staging dupes, harvest, AI agent workers, Take-A-Break | issues-to-fix.md #5,13,14,15,16,17,18,19,21 (open) |
| ESUT/OGBL rebrand (#8) | belongs to ESUT project — skipped here, but see NEW-1 below (ESUT repo leaks ESUT domain) |

### 12. Additional gaps independently discovered

| # | Gap | Severity | Evidence |
|---|---|---|---|
| NEW-1 | **Sitemap advertises another institution's domain**: every `<loc>` uses `https://virtuallibrary.esut.edu.ng/` while robots.txt points to `esutlibrary.edu.ng` and OAI BASE_URL uses a 4th host `library.esut.edu.ng` | HIGH | `public/sitemap.xml:5+`, `public/robots.txt`, `supabase/functions/oai-pmh/index.ts:4`, `app/repository-sitemap.xml/route.ts:8` |
| NEW-2 | **5 IR tables with zero RLS** | CRITICAL | `20260705120000_catalog_ir_separation.sql:6,33,43,54,64` |
| NEW-3 | **Production DB credentials committed in tracked files** | HIGH | `check_jobs.js:3`, `check_schema.js:3` (both in `git ls-files`) |
| NEW-4 | **OAI-PMH has 14 concrete bugs** even if exposed (see Part II §A) | HIGH | `supabase/functions/oai-pmh/index.ts` |
| NEW-5 | **IrDeposit inserts 5 nonexistent columns** → admin IR deposit fails | HIGH | `admin/IrDeposit.tsx:74-92` vs `20260705120000…sql:15-26` |
| NEW-6 | `researcher_teaching` queried with no DDL; also filters `status='approved'`/`year_start` vs schema `published`/`year` | HIGH | `ResearcherProfile.tsx:79,61,76` vs `…20260620202944…sql:624-653` |
| NEW-7 | AI endpoints unauthenticated + unrate-limited; middleware exempts `/api/ai/` from CSRF and rate limits | MEDIUM | `middleware.ts:5-7`; `app/api/ai/reference-librarian/route.ts:28` |
| NEW-8 | Admin agent jobs API whitelists 8/10 job types | MEDIUM | `app/api/admin/agents/jobs/route.ts:9-18` vs `worker/handlers/index.ts:10-21` |
| NEW-9 | RepositoryStats DOI counter always 0; "OAI-PMH Harvests" mislabeled | MEDIUM | `RepositoryStats.tsx:46,47,154,155` |
| NEW-10 | Permissive RLS leftovers (`using(true)` on `item_versions`, `report_snapshots`, etc.) | MEDIUM | `…20260620202944…sql:230-234,568` |
| NEW-11 | Orphan edge functions (`federated-search`, `ebook-search`, plus `send-email` kept only for `calendar-rules`/`alumni-automation`) | LOW | zero call sites in `src/`/`app/` |
| NEW-12 | No caching layer, no APM/observability beyond health checks, Arcjet key absent in env | MEDIUM | `middleware.ts:10,48-52`; env inspection |
| NEW-13 | `next.config.mjs` ignores TS and ESLint errors → green build ≠ correct build | MEDIUM | `next.config.mjs` |
| NEW-14 | Stale generated Supabase types (99/121 tables) | MEDIUM | `src/integrations/supabase/types.ts` |
| NEW-15 | `next-prompt.md`/`docs/features-by-role-and-benchmark.md` untracked; migration docs stale | LOW | `git status` |

### 13. Dependency graph (what must come first)

```
[security/RLS fixes + credentials cleanup]      ← blocks any production claim
        │
[migration strategy + test baseline]            ← blocks schema changes safely
        │
[event/notification infrastructure] ──── [permissions review: 4 open routes + App.tsx guard]
        │
[repository object/file model]                  ← blocks OAI-PMH, versioning, fixity
        ├──> [OAI-PMH endpoint]  ←── also needs: identifier scheme + sets vocabulary
        ├──> [persistent identifiers framework]
        ├──> [full-text indexing] ←── needs: single source-of-truth search table
        └──> [real analytics/events] ←── needs: event infrastructure
        │
[embargo/rights/checksum/versioning]  ← needs: object model + events
        │
[MARC consolidation] → [Z39.50/SRU] ←── needs: MARC + authority links
        │
[ILS ops: SIP2/offline/EDI] → [SWORD/COAR/ResourceSync/ORCID] → [report writer/COUNTER/i18n]
```

Rule (next-prompt.md): no wave advances while migrations/build/tests fail.

---

## Part II — Capability audit

### A. Interoperability & standards

| Feature | Status | Evidence (file:line) | Sev | Recommended implementation |
|---|---|---|---|---|
| OAI-PMH 2.0 provider | **BROKEN** (unreachable + 14 bugs) | `supabase/functions/oai-pmh/index.ts:4` BASE_URL `/api/oai` has no route (73 API routes, no `oai`); no rewrite in `next.config.mjs:1-27`; no `[functions.oai-pmh]` in `supabase/config.toml` → `verify_jwt=true` blocks anonymous harvesters | CRITICAL | New `app/api/oai/route.ts` implementing all 6 verbs server-side with validated params, UTC `YYYY-MM-DDThh:mm:ssZ` datestamps, signed expiring resumption tokens with `completeListSize`, consistent sets vocabulary, `badArgument`/`badResumptionToken`/`noRecordsMatch` semantics, oai_dc (+ marc21 later), unit + interop tests, feature flag `OAI_ENABLED`, docs `docs/interoperability/oai-pmh.md` |
| OAI-PMH bugs (existing fn) | **BROKEN** | 14 bugs incl.: advertised baseURL 404 (:4); double-nested `<header>` (:242); `oai_marc` advertised but always oai_dc (:141,167,201 vs :193,247); set filter uses `faculty_code` while ListSets emits community slugs (:150-160,227); GetRecord skips visibility filter (:221 vs :174); ordering by `created_at` but datestamping `updated_at` (:222,238); empty page + token → error (:231-233); token prefix dead (:211,254); no `completeListSize`/signed token (:253-255); missing `verb`→`badVerb` not `badArgument` (:264); no granularity validation (:225-227); fractional-seconds `responseDate` (:63,68) | HIGH | Fix or replace during WAVE 1 (prefer replacing with route handler sharing DB queries) |
| Z39.50 | **MOCKED** (client) / **ABSENT** (server) | `admin/CatalogueNew.tsx:55-60` sources unused; Open Library proxy `:318-323`; `z3950_imports` mislabeled write `:495-497` | HIGH | WAVE 3: honest relabel now (quick win), real gateway later via adapter; remove decorative source selector or wire to real targets |
| SRU | **ABSENT** | only label in `config/openAccessDatabases.data.ts:1307` | MEDIUM | WAVE 3 client+server via shared MARC/XML layer |
| MARC21 | **PARTIAL** | 3 coexisting representations `…20260620202651…sql:47,763-764,756-762`; XML export `admin/Catalogue.tsx:374-404` | MEDIUM | Consolidate on leader+fields as canonical, derive others; validate with marc viewers |
| Authority control | **PARTIAL** | table+CRUD `…20260620204347…sql:66-83`, `admin/CatalogueAuthorities.tsx:54-146`; no FK from catalogue | MEDIUM | Link headings via authority id, dedupe/merge tool |
| SIP2 / EDI / COAR Notify / ResourceSync / SWORD / OpenURL / KBART / COUNTER-SUSHI | **ABSENT** | case-sensitive sweep = 0 matches across `src/`, `app/`, `worker/`, `supabase/` | MEDIUM→LOW | Per waves 4-6; each behind a feature flag |
| DOI | **PARTIAL** | resolve: `adapters.ts:169,414-423`, `normalize.ts:6-40`; mint: `zenodo-publish/index.ts:104-127` (needs `ZENODO_TOKEN`); no DataCite/Crossref code | MEDIUM | Provider adapter interface (`DoiProvider`) with Zenodo now, DataCite later; set DOI on all publish paths |
| Handle | **PARTIAL** | local mint `moduleSeparation.ts:34`; column `…20260925120000…sql:4`; no handle.net | LOW | Document local-namespace policy; register at handle.net when ready |
| ORCID | **IMPLEMENTED** | v3.0 API validation `RepositorySubmit.tsx:30-45,96-115`; edge `publication-fetch/index.ts:103-140,289-322`; DB `orcid_id`/`orcid_verified` | — | Keep; move server-side later to avoid browser CORS/PII exposure |
| Federated discovery | **IMPLEMENTED** | 14 real adapters `adapters.ts:26-442`; `app/api/search/resources/route.ts:79-146`; rate-limited 20/hr | — | Keep; retire orphan edge fns |
| Robots/sitemap | **BROKEN** | `public/sitemap.xml:5` = `virtuallibrary.esut.edu.ng`; robots → `esutlibrary.edu.ng`; `app/repository-sitemap.xml/route.ts:8` = `esutlibrary.edu.ng`; OAI host = `library.esut.edu.ng` | HIGH | Pick canonical base URL (env `NEXT_PUBLIC_SITE_URL`), regenerate sitemap, unify all four |

### B. Repository & preservation

| Feature | Status | Evidence | Sev | Recommended implementation |
|---|---|---|---|---|
| Repository object/file model | **PARTIAL** | dual `repository_items`/`ir_items`; `library_objects`+B2 side path | HIGH | Single canonical item + file/bitstream table (WAVE 1), keep old columns as views |
| IR admin deposit | **BROKEN** | `admin/IrDeposit.tsx:74-92` inserts 5 columns absent from `repository_items` | HIGH | Fix column set or route deposits through canonical model |
| Embargo | **PARTIAL** | column set (`RepositorySubmit.tsx:172-195`, `IrDeposit.tsx:81,90`) but read path never enforces it; invalid `'embargoed'` filter `app/api/repository/route.ts:15` | HIGH | Enforce `embargo_until > now()` → hide bitstream (metadata stays), fix status filter, log attempts (`ir_embargo_logs` exists, unused) |
| Versioning | **BROKEN** | `item_versions` only ever written with `version_number: 1` (`zenodo-publish/index.ts:130-135`) | MEDIUM | Deposit-time version increments, diff notes, file-per-version |
| Checksums/fixity | **ABSENT** (one nullable column) | `library_objects.checksum` `…20260626103000…sql:11` | HIGH | SHA-256 at upload for every file, verify job (worker), store in fixity table |
| Access rights | **PARTIAL** | `visibility` enum only (`…sql:102`); no license enforcement (`ir_licenses` unused) | MEDIUM | License field required at deposit; rights statements in metadata |
| AIP/preservation exports | **ABSENT** | none | LOW | WAVE 2 bag-it style export job after fixity exists |
| Usage stats | **PARTIAL** | counters `…sql:48,757`; `RepositoryStats.tsx` real (with bugs) | MEDIUM | Event table (WAVE 1) feeds stats; fix `:46-47` bugs now |

### C. Platform services

| Feature | Status | Evidence | Sev | Recommended implementation |
|---|---|---|---|---|
| Email | **IMPLEMENTED** | `src/server/email/**` (Resend primary → Gmail fallback), gateway `app/api/email/send`, admin `app/api/admin/email/test`, live-verified | — | Keep; Resend domain verification pending (owner action) |
| Rate limiting | **PARTIAL** | `middleware.ts:58-72` only on `sensitivePrefixes` (`:5`); Arcjet key absent; per-route Maps (restart-unsafe) | MEDIUM | Move hot limits (search, AI, auth) to DB/Redis-backed or at least widen prefix list; document single-instance assumption |
| Caching | **ABSENT** | only TTS `Cache-Control` `lyria-voice:76,100` | LOW | Add HTTP caching for public catalogue/OAI responses |
| Logging | **IMPLEMENTED** | winston `logger.ts:42` + redaction `:12` + child loggers `:49` | — | Ship logs to file/collector on VPS (WAVE 6) |
| Observability | **PARTIAL** | `/api/health/schema` (5 tables) `app/api/health/schema/route.ts:7-21`, worker health proxy | MEDIUM | Add metrics endpoint, uptime checks, error tracking |
| Upload pipeline | **IMPLEMENTED** | Supabase buckets (PDF-only/100MB) + B2 signed upload | — | Add size/type re-validation server-side + AV scan option |
| PDF processing | **PARTIAL** | `repository.extractMetadata` handler `worker/handlers/repository.ts:8`; no text extraction/index | MEDIUM | Add extracted text to FTS (WAVE 1) |
| Cron/scheduler | **IMPLEMENTED** | `worker/scheduler.ts:14-46` | — | Document schedules in admin UI (exists) |
| Feature flags | **ABSENT** | no OAI_ENABLED/SRU_ENABLED etc. | MEDIUM | Env-based flags per next-prompt.md list, wired to `config/` |

### D. Security & RBAC

| Feature | Status | Evidence | Sev | Recommended implementation |
|---|---|---|---|---|
| IR tables RLS | **ABSENT** | 5 tables, migration `20260705120000` | CRITICAL | Migration: enable RLS + admin/read policies; verify with `diag-rls` |
| Committed DB credentials | **BROKEN** (leak) | `check_jobs.js:3`, `check_schema.js:3` tracked | HIGH | Remove from tree, rotate password (owner approval), add `*.js` root probes to `.gitignore` |
| Open mutating routes | **PARTIAL** | 4 of 19 unauthenticated routes mutate | HIGH | WAVE 0 permissions review → require auth/roles or CSRF+validation |
| Student route guards | **PARTIAL** | `src/App.tsx:234-235` missing `FeatureRoute` | MEDIUM | Add guards (issues-to-fix #7) |
| Dual role system | **PARTIAL** | `user_roles` vs `librarians`, late enum drift | HIGH | Single source: `user_roles` + view for legacy reads (WAVE 0 review, migrate carefully) |
| AI endpoints protection | **ABSENT** | `middleware.ts:5-7` exempts `/api/ai/` | MEDIUM | Rate limit + (optional) session requirement, keep public widget working |
| Turnstile | **DEPRECATED/DISABLED** | `turnstile.ts:20-23` always true | LOW | Re-enable only when keys exist; else remove dead config endpoints |
| CSRF | **PARTIAL** | cookie/header `middleware.ts:102-125` with exemptions `:7` | MEDIUM | Tighten exemptions to registration-only POSTs |
| Stale types | **DEPRECATED** | `types.ts` 99/121 tables | MEDIUM | Regenerate via `supabase gen types` |
| Dead code `src/views` | **DEPRECATED** | excluded `tsconfig.json:54` | LOW | Delete in cleanup wave (after confirming no runtime imports) |

### E. Keyword sweep result

- `TODO/FIXME/XXX/HACK` in `src/`, `app/`, `worker/`, `scripts/`, `supabase/`: **0**.
- Filtered mock/fake/stub/hard-coded matches: **17**, of which 14 are legitimate vitest mocks (`*.test.ts`); genuine UI: `FacultyLibraries.tsx:95` and `LibraryBranch.tsx:642` ("Coming Soon"), `Media.tsx:192`, `HandbookSection.tsx:3,30`, `data/media.ts:131`.
- Real "fake data" risk is NOT in keywords: it is `admin/Analytics.tsx` (fully hardcoded) and the Z39.50 source labels.
- Standards keywords: SIP2/SWORD/COAR/ResourceSync/KBART/OpenURL/COUNTER/SUSHI case-sensitive = **0**; SRU = 1 directory label; MARCXML = 1 (advertised in broken OAI fn).

---

## Part III — Severity rollup

**CRITICAL:** (1) 5 IR tables without RLS; (2) OAI-PMH advertised but non-existent while docs claim "Complete".
**HIGH:** committed DB credentials; IrDeposit broken inserts; sitemap/robots/OAI host domain split (ESUT leak); dual role system; `researcher_teaching` no DDL; Z39.50 mocked-as-real; open mutating routes; no migration runner; embargo not enforced; no fixity.
**MEDIUM:** admin analytics mocked; repository versioning broken; FTS unused; AI endpoints unprotected; rate limits single-instance; permissive RLS leftovers; stale types; build ignores errors; agent job whitelist 8/10; no observability; no feature flags.
**LOW:** orphan edge fns; dead `src/views`; "Coming Soon" pages; Turnstile dead config; missing docs (standards conformance, per-protocol pages).

---

## Part IV — Implementation order (maps to next-prompt.md waves)

1. **WAVE 0** — audit (this doc) ✔; migrations strategy (`docs/implementation-progress.md` §Migration state); test baseline (vitest 64 / tsc 64 baseline) ✔; event infrastructure; permissions review (4 open routes, `App.tsx:234-235`, `/api/ai/` limits, CSRF exemptions).
2. **WAVE 1** — canonical repository object/file model → `app/api/oai/**` provider (+ tests + flag) → identifier framework (DOI/HANDLE adapter interface) → usage/event table feeding real analytics → FTS migration from ILIKE.
3. **WAVE 2** — versioning, file-level access, embargo enforcement, rights/license, checksum+verify job, AIP export, stats fixes (`RepositoryStats.tsx:46-47`).
4. **WAVE 3** — MARC consolidation, honest Z39.50 relabel → real gateway, SRU, authority linking, duplicate management.
5. **WAVE 4** — offline circulation hardening, notices/slips, acquisitions currency, EDI/POS/serials depth, SIP2 (flagged).
6. **WAVE 5** — SWORD, COAR Notify, Signposting, ResourceSync, ORCID server-side, ROR, OpenURL, KBART.
7. **WAVE 6** — report writer, COUNTER/SUSHI, multilingual, a11y, API docs, backups/DR, observability, security hardening, performance.

Security fixes in Part III CRITICAL/HIGH are pulled forward into WAVE 0/1 regardless of wave mapping.
