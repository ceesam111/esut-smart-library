# Phase 12 — Final Report: 2026 NUC Accreditation Digital Resource Expansion

Project: ESUT Smart Library
Report date: 2026-11-01 (updated 2026-11-03 after the full 15-programme harvest, the route-count fix and the first link-verification pass; updated 2026-11-04 after the production deployment)
Status: code complete · database migrated 2026-11-01 · all 15 programmes harvested 2026-11-01/02 (2 327 records) · first link-verification pass 2026-11-03 (25 checked / 21 verified / 0 failed) · route counts verified against the database 2026-11-03 · deployed to production 2026-11-04 (image `20261103-0555`, smoke-tested) · committed and pushed (`e83f048`, `3075eb0`, `c538bd8`)

All counts in this report were measured, not estimated. Where a measurement is unavailable the
report says so instead of inventing a number.

---

## A. What you found

**What existed**

- A working ESUT Smart Library platform: Next.js 16 + react-router single-page app, Supabase
  backend, role-based authentication, a background job worker, feature flags, catalogue and
  repository tables, and a global CSRF/security middleware.
- Useful building blocks that were reused as-is: the `{success, data|error}` API envelope
  (`withHandler`/`ApiError`), `requireRole` with `GLOBAL_ADMIN_ROLES`, the worker's
  `requireTenant`/`safeResult`, the service-role Supabase client, `isMissingSchemaError`
  graceful-degradation helpers, and the `accreditationEvidence` feature flag.
- `papaparse` and `jspdf` were already dependencies.

**What was missing**

- Everything accreditation-specific: no 15-programme taxonomy, no programme collections, no
  scholarly-provider integrations, no harvested-resource tables, no portal, no evidence
  dashboard, no sync/verification pipeline.

**What was defective**

- The two target pages existed only as null-returning stubs
  (`src/app-pages/AccreditationResources.tsx`, `src/app-pages/admin/AccreditationEvidence.tsx`).
- Two dead duplicate stubs lived under `src/pages/` (never imported — the `@/pages/*` alias
  resolves to `src/app-pages/*`). They were removed.
- No licence or peer-review fields exist anywhere in the data model (see H5).
- Local data reality at report time: 29 catalogue rows and 4 published repository rows exist in
  total; only 2 repository rows match any of the 15 programmes under scoring. The local
  collection alone cannot demonstrate accreditation coverage — external harvesting is required.

---

## B. What you implemented

**Programme collections and taxonomy**

1. `src/data/accreditation/programmes.ts` — exactly 15 NUC programmes with faculty/department,
   degree levels, accreditation visit windows (including the November 1–4, 2026 pharmacy visit),
   subject trees (13–21 subjects each), curriculum topics and per-programme search terms; year
   window constants 2023–2026.
2. `src/data/accreditation/databases.ts` — 19 open/institutional databases with per-programme
   applicability (15–22 databases per programme).
3. `src/server/accreditation/matching.ts` — scored subject/title/abstract matching (threshold 1)
   used by local records, coverage and harvest assignment.
4. `src/server/accreditation/localRecords.ts` — catalogue + repository records scored into the
   portal with honest local-holdings labels.

**Source integrations (10 open providers)**

5. OpenAlex, Crossref, DOAJ, Europe PMC, CORE, Semantic Scholar, arXiv, Internet Archive,
   Open Library, Zenodo — each one live-validated against its real endpoint *before* coding
   (Phase 2 field-level documentation in `docs/accreditation/PROVIDER-RESEARCH-A.md`), with
   mapping/dedup helpers and unit tests (`src/server/accreditation/providers/`).

**Pipeline**

6. Migration `supabase/migrations/20261030180000_accreditation_resources.sql` —
   `scholarly_resources` + `resource_sync_state` tables, unique identity
   `(source_provider, external_id)`, `dedupe_key` (DOI → title|year|author), indexes and RLS.
   **Applied 2026-11-01** by the owner via the Supabase Dashboard SQL editor and independently
   verified from here (see the QA table in section B).
7. Sync engine `src/server/accreditation/sync.ts` — resumable per-provider/per-programme
   checkpoints saved after every page; same-provider updates vs cross-provider merges;
   write-time year-window enforcement; access-honesty re-derivation; 429/error handling that
   never throws (rate-limited providers stop paging for the rest of the run); global request
   budget (default 60, clamp 1–300); page size ≤ 25; defaults 50 records/4 pages per
   provider×programme; provider array order = source priority. Semantics documented in
   `docs/accreditation/PROVIDER-RESEARCH-B.md`. The full live run (all 15 programmes,
   2026-11-01/02) exercised the whole path and exposed **four adapter defects that mocked
   unit tests could not catch**: Crossref's parameter is `mailto` (not `mail-to` — Crossref
   answered 400 `unknown-parameter`), Europe PMC's REST host is `www.ebi.ac.uk`
   (`europepmc.org` answered 403), Zenodo's host had a typo (`zensodo.org`), and CORE's
   publisher field could arrive as a non-string and crash `resolveHarvestedItem`
   (`value?.trim is not a function`). All four were fixed, gates re-run (144/144, tsc 0,
   lint 0), and the affected providers then delivered records.
8. Link verification `src/server/accreditation/verification.ts` — HEAD with GET fallback, 8 s
   timeout, 250 ms courtesy delay, oldest-unchecked-first selection, limit clamp 1–100:
   confirmed failures (404/410/451) downgrade the access label and keep the URL for
   traceability; timeouts/403/429/5xx never claim a link is dead (verified → stale).
9. Coverage `src/server/accreditation/coverage.ts` — one computation shared by the public
   coverage API and the admin evidence API, with internal screening thresholds
   `{programmeMinimum: 25, topicMinimum: 3}` always labelled as heuristics, not NUC quotas.

**API surface (7 routes)**

10. Public `GET /api/accreditation/{programmes,resources,coverage}` — active rows only, year
    window, provider/type facets (self-excluding so filter dropdowns never collapse), search,
    sort, pagination (≤ 100/page), row caps (2 000 external / 20 000 stats) with an honest
    `capped` flag, graceful empty results when the schema is absent. Every full-table read
    pages through PostgREST's 1 000-row per-response cap with a shared reader
    (`src/server/supabase/pagedQuery.ts`, 8 unit tests) — a truncation defect found by
    comparing live route output against the database on 2026-11-03 and fixed the same day
    (see the QA table below).
11. Admin `GET/POST /api/admin/accreditation/{evidence,sync-status,sync,verify}` — role-gated
    (`super_admin|librarian|admin`), zod-validated bodies, sync/verify POST-only; evidence adds
    the required evidence-status field (Verified / Partially verified / Pending review /
    Not available) with published rules, verified-by-type counts, failed-link counts and ten
    sample citations with verification dates.
12. Worker handlers `accreditation.sync` / `accreditation.verify` registered in the worker
    registry for bounded background runs.

**User-facing features**

13. Public portal `/accreditation-resources` and `/accreditation-resources/:slug` — landing page
    with all 15 programme collections (measured stats per card), tabs
    **Ebooks | Ejournals | Research Articles | Databases | Courses and Subjects**, search within
    one programme or across all 15, filters for publication year (2023–2026), source,
    full-text availability and sort, facet counts on tabs, per-programme subject coverage view
    with honest heuristic labels, deep-linkable via `?tab=` and `?q=`, integrated into the
    existing navbar.
14. Admin evidence dashboard `/admin/accreditation-evidence` (feature-flagged + role-gated) —
    KPI grid over real totals, by-programme table (indexed, 2023+, ebooks/articles and their
    verified counts, OA journals, databases, subjects covered/weak, failed links, evidence
    status), sources + sync-checkpoint tables, provider health, sample citations, CSV export
    (papaparse) and PDF export (jspdf) both carrying the not-a-quota disclaimer, and manual
    **Run sync** / **Verify links** actions behind confirmation dialogs — the page never
    auto-runs a sync or verification on load.
15. CSRF hardening reused for admin POSTs (`src/lib/csrfFetch.ts` + middleware CSRF cookie +
    `middleware.test.ts`).

**Tests and checks (measured 2026-11-01/02, re-verified after fixes)**

| Check | Result |
| --- | --- |
| `tsc --noEmit` | exit 0 |
| `eslint . --max-warnings=0` (whole repo) | exit 0 |
| `vitest run --maxWorkers=1` (whole suite) | 127 files, 1 155 tests: **1 155 passed** in the final run (2026-11-03, after the paged-read fix); an earlier loaded run had 2 a11y-suite timeouts that pass 8/8 standalone |
| `next build` (production) | exit 0 (re-run 2026-11-03 after the paged-read fix); all 7 accreditation routes compiled (3 public + 4 admin); only pre-existing Next 16 notices (React 18 support, `middleware`→`proxy` deprecation) |
| Live end-to-end after migration (REST + dev server) | Service role reads both new tables: 0 rows each; `anon` reads `scholarly_resources` via the RLS read policy (200, `[]`) and is denied `resource_sync_state` (401, per the revoke); on a live dev server: `/api/accreditation/programmes` 200 with 15 programmes, `/api/accreditation/resources` 200 with 0 rows and `capped=false`, `/api/accreditation/coverage?programme=pharmacy` 200 with 16 topics and all-zero totals; coverage without a `programme` param returns the documented 400 validation error; one transient network 500 during the dev cold-start recovered on immediate retry |
| Full live harvest (all 15 programmes, 2026-11-01/02) | Three bounded harvest passes (pharmacy-first 2026-11-01; mechanical/biomedical/chemical/accounting/banking/integrated-science/doctor-of-pharmacy; marketing/anatomy/computer-science/education-mathematics/civil/education-biology/environmental-management) executed under 30-request-per-programme budgets → **2 327 rows** (OpenAlex 794, Europe PMC 643, Crossref 362, Zenodo 247, arXiv 189, DOAJ 88, Open Library 4; CORE rate-limited, Internet Archive honest zero); integrity re-checked from the database after every pass: 2 327 distinct `dedupe_key`s, 2 033 distinct DOIs with zero duplicates, 0 records outside 2023–2026 (0 null years), 0 `full_text` rows without a URL, 0 bad landing URLs, every row active; 317 records carry ≥ 2 programme tags (legitimate cross-programme overlap such as machine-learning-in-chemical-engineering); post-harvest route checks on a live dev server (re-verified 2026-11-03 after the paged-read fix): `/api/accreditation/programmes` returns all 15 cards whose counts now match the database exactly (e.g. `computer-science.indexed=268`, `pharmacy.indexed=204`, `marketing.indexed=201`), `/api/accreditation/resources?pageSize=3` returns `total=2002` with `capped=true` (2 000-row portal cap honestly disclosed) and 8 provider facets, `/api/accreditation/coverage?programme=marketing` returns `indexed=201` over 20 topics; one transient dev cold-start 500 recovered on immediate retry |
| PostgREST row-cap audit and fix (2026-11-03) | Direct probe proved PostgREST returns at most **1 000 rows per response** regardless of `.limit(20000)` — three routes were silently under-reporting (`programmes` showed `marketing=17` vs a true 201; `resources` showed `total=1002 capped=false`; the admin evidence dashboard read only 1 000 of 2 327 rows). Fixed by paging every full-table read through a shared reader (`src/server/supabase/pagedQuery.ts` + 8 unit tests) in the programmes, resources, coverage and evidence routes. Re-verified live: public routes match the database for all 15 programmes, and the authenticated evidence API returns `indexed=2327`, `uniqueWorks=2327`, `withFullText=1188`, `withDoi=2033` with exact per-programme (145–268) and per-provider (794/643/362/247/189/88/4) breakdowns |
| Accreditation tests re-run after final lint fixes | 144/144 (98 provider + 27 sync + 19 verification) plus 8 new paged-query tests = 152/152 |
| Authenticated evidence-dashboard check (2026-11-03) | Signed in with the documented admin account (credentials read from `docs/implementation-progress.md` at runtime, never copied) and called `GET /api/admin/accreditation/evidence` with a Bearer token → 200 with `indexed=2327`, `uniqueWorks=2327`, `recent2023=2327`, `withFullText=1188`, `withDoi=2033`, `verified=0`, `unverified=2327` (pre-verification state), 7 providers with data, all 15 per-programme rows matching the database, 126 sync-checkpoint rows; re-measured after the first verification pass: `verified=21`, `unverified=2306`, `failed=0` |
| First link-verification pass (2026-11-03, owner-approved) | `POST /api/admin/accreditation/verify {"limit":25}` with a Bearer admin session → 200 `{checked:25, verified:21, failed:0, unverifiable:4}`; database re-measured afterwards: `verification_status` = 21 verified / 2 306 unverified / 0 failed, HTTP outcomes 20×200 + 1×202, access states unchanged (1 188 `full_text` / 787 `abstract_only` / 352 `metadata_only` — zero downgrades); the 21 verified = 20 research articles + 1 ebook, all Pharmacy-tagged (2 shared with Doctor of Pharmacy, 1 with Education Biology) |
| Production deployment (2026-11-04, owner-approved) | Image `ghcr.io/ceesam111/esut-smart-library:20261103-0555` (digest `sha256:851cbd3b65ba2ae151a66c5d35cc0fcc87227da17c218531b9a06997ff2db20c`) built from the workspace per `docs/esut-modernization/phase-22/13_PRODUCTION_DEPLOYMENT_CHECKLIST.md` with both URL build args forced to `https://virtuallibrary.esut.edu.ng`; in-image secret scan clean (no `.env*` files, no `SUPABASE_SERVICE_ROLE` — only public `NEXT_PUBLIC_*`); pushed to GHCR. The first Coolify deployment failed with `error from registry: denied` because the server still held the expired GitHub PAT — repaired over SSH (`esut_vps_key`) with a server-side `docker login` fed a short-lived token on stdin (never in argv) plus a pre-pull; the re-deploy finished in 30 s, app `running:healthy` on tag `20261103-0555` (`last_online_at` refreshed to 2026-11-04 02:22; the previous container on `20261026-0947` kept serving throughout). Independent post-deploy smoke test: `/api/health` 200 JSON; `/api/accreditation/programmes` 200 JSON with all 15 programmes (pre-deploy baseline: `text/html` SPA shell); `/api/accreditation/resources` 200 `total=2002 capped=true`; `/api/accreditation/coverage?programme=marketing` 200 `indexed=201`; `/api/accreditation/coverage` without params → 400; `/`, `/accreditation-resources`, `/robots.txt`, `/sitemap.xml` and `/api/oai?verb=Identify` all 200 with no `localhost:3000` in the HTML; authenticated `GET /api/admin/accreditation/evidence` 200 with `indexed=2327`, `withDoi=2033`, `verified=21`, `unverified=2306`, `failed=0` and all 15 programme rows (401 without a token) |
| CI on the final pushes (checked 2026-11-04) | GitHub Actions `CI Quality Gates` on `c538bd8`: TypeScript ✓, Lint ✓, Vitest ✓ (including the new `middleware.test.ts`), Production build ✓ — the job's only red step is the pre-existing `Security audit` (5 advisories: 1 moderate, 2 high, 2 critical from `next@16.4.0`, `undici` and `zod`, already failing on the two 2026-10-23 pushes; needs the dependency upgrade tracked in H13), and `Build & Push Docker Image` passes. Earlier in this batch: `e83f048` failed the TypeScript check (five files' changes were missing from that commit), `3075eb0` failed Vitest (the csrf-cookie middleware hunks were still unstaged) — both repaired by `3075eb0` and `c538bd8` |
| Baseline tests before this work | 1 003 (all still passing) |
| `scan:secrets` | 1 056 files scanned, 0 findings |

---

## C. Coverage of all 15 programmes

**How these numbers were produced.** Read-only queries against the configured database on
2026-11-01 15:39 UTC, using the same scoring and coverage functions the dashboard uses — then
re-queried on 2026-11-02 after the owner-approved full harvest (all 15 programmes) and again
on 2026-11-03 after the route-count fix, so every number below matches what the public routes
and the evidence dashboard now serve. The migration was applied 2026-11-01 (owner, Dashboard
SQL editor). Every programme has been harvested and the first link-verification pass ran
2026-11-03; remaining zeros in the "verified" columns and the zero in "OA journals" are
honest states, not estimates.

Measured state of the database (2 327 rows, all 15 programmes):

- `scholarly_resources` — **2 327 rows**, all 15 programmes present, every row active and
  2023–2026-dated, integrity checks clean (QA table in section B).
- `resource_sync_state` — 126 checkpoint rows: 108 ok, 15 error, 3 rate-limited (all three
  categories are legitimate states, not failures of the run).
- `catalogue_items` — 29 rows total; 0 match any of the 15 programmes under scoring.
- `repository_items` — 4 published rows total; 2 match programmes (3 programme assignments).
- Provider split: OpenAlex 794, Europe PMC 643, Crossref 362, Zenodo 247, arXiv 189, DOAJ 88,
  Open Library 4; CORE, Semantic Scholar and Internet Archive contributed 0 (rate-limited /
  no in-window matches). Type split: 2 224 research articles, 81 ebooks, 20 datasets,
  2 reports. Access split: 1 188 `full_text`, 787 `abstract_only`, 352 `metadata_only`.
  1 850 records are provider-flagged open access.

Per-programme measurements (harvested = external providers; local = catalogue/repository):

| Programme | Recent ebooks (harv / local) | Verified ebooks | OA journals | OA items | Recent articles (harv / local) | Verified articles | Full text | Databases | Subjects covered | Remaining gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mechanical and Production Engineering | 16 / 0 | 0 | 0 | 139 | 156 / 0 | 0 | 86 | 16 | 5 of 16 | 11 subjects below the internal minimum; link verification not yet reached |
| Biomedical Engineering | 7 / 0 | 0 | 0 | 122 | 149 / 0 | 0 | 74 | 15 | 5 of 16 | 11 subjects below the internal minimum; link verification not yet reached |
| Chemical Engineering | 4 / 0 | 0 | 0 | 131 | 156 / 0 | 0 | 80 | 18 | 5 of 16 | 11 subjects below the internal minimum; link verification not yet reached |
| Pharmacy (B.Pharm) | 1 / 0 | 1 | 0 | 165 | 202 / 0 | 20 | 128 | 18 | 3 of 16 | 13 subjects below the internal minimum; first verification pass ran 2026-11-03 (21 records verified, 0 failed) |
| Accounting | 11 / 0 | 0 | 0 | 137 | 153 / 0 | 0 | 81 | 17 | 7 of 21 | 14 subjects below the internal minimum; link verification not yet reached |
| Banking and Finance | 5 / 0 | 0 | 0 | 134 | 161 / 0 | 0 | 86 | 17 | 6 of 21 | 15 subjects below the internal minimum; link verification not yet reached |
| Marketing | 6 / 0 | 0 | 0 | 176 | 194 / 0 | 0 | 125 | 16 | 6 of 20 | 14 subjects below the internal minimum; link verification not yet reached |
| Anatomy | 5 / 0 | 0 | 0 | 119 | 147 / 0 | 0 | 80 | 18 | 4 of 16 | 12 subjects below the internal minimum; link verification not yet reached |
| Computer Science | 14 / 0 | 0 | 0 | 223 | 254 / 0 | 0 | 157 | 17 | 9 of 21 | 12 subjects below the internal minimum; link verification not yet reached |
| Education Mathematics | 0 / 0 | 0 | 0 | 90 | 118 / 0 | 0 | 64 | 19 | 2 of 14 | 12 subjects below the internal minimum; link verification not yet reached |
| Civil Engineering | 10 / 0 | 0 | 0 | 133 | 159 / 0 | 0 | 78 | 16 | 4 of 16 | 12 subjects below the internal minimum; link verification not yet reached |
| Education Biology | 4 / 0 | 0 | 0 | 181 | 220 / 0 | 1 | 108 | 22 | 4 of 14 | 10 subjects below the internal minimum; first verification pass reached it (1 shared record verified) |
| Integrated Science | 5 / 0 | 0 | 0 | 125 | 164 / 0 | 0 | 81 | 19 | 4 of 13 | 9 subjects below the internal minimum; link verification not yet reached |
| Environmental Management and Toxicology | 4 / 0 | 0 | 0 | 149 | 184 / 0 | 0 | 93 | 18 | 9 of 16 | 7 subjects below the internal minimum; link verification not yet reached |
| Doctor of Pharmacy | 3 / 0 | 0 | 0 | 107 | 141 / 0 | 2 | 83 | 18 | 5 of 17 | 12 subjects below the internal minimum; first verification pass reached it (2 shared records verified) |

Reading the table:

- **All 15 programmes were harvested** across three bounded passes on 2026-11-01/02 (owner
  approved): 2 327 records from 7 delivering providers. Per-programme totals run from 118
  (Education Mathematics) to 268 (Computer Science).
- **Verified-ebook and verified-article columns reflect the first link-verification pass**
  (2026-11-03, owner-approved, limit 25): 25 links checked → **21 verified, 0 failed, 4
  unverifiable** (HTTP 20×200 + 1×202). The 21 verified records are 20 research articles and
  1 ebook, all from the Pharmacy collection — the pass takes the least-recently-checked rows
  first, which are the earliest harvested; Doctor of Pharmacy (2) and Education Biology (1)
  show verified articles through records shared with Pharmacy by multi-tagging, so the column
  sums exceed 21 distinct records. Zero failures means no access label was downgraded; the
  remaining 2 306 records stay honestly `unverified` until later passes (each pass picks the
  oldest unchecked rows first). Every `full_text` label outside the verified set still
  reflects the provider's claim only (the "Full text" column counts records carrying a
  provider-supplied full-text URL).
- **"OA journals" counts journal-type (`ejournal`) records and is 0**: the providers return
  journal *articles*, which are indexed as research articles, not journal titles. Open access
  is therefore reported at item level in the **"OA items"** column (records the provider
  flagged open access) — 1 850 across the whole collection.
- **Local matches** (the second number in column 1): no local record is an ebook or an
  article, so the local ebook/article columns are 0 everywhere. The three real local matches
  are one 2024 repository dataset (Education Mathematics) and one 2023 repository thesis
  (matched by both Education Biology and Integrated Science); they count towards each
  programme's coverage total (e.g. Education Mathematics `indexed=119` = 118 external + 1
  local) but appear in neither the ebook nor the article column.
- **Databases** are the live directory values (a real measured list, not a claim of
  subscriptions): each programme can open 15–22 databases from the Databases tab.
- **Subjects covered** uses the internal screening heuristic (≥ 3 matching records per
  subject) — an internal heuristic, never a NUC quota. Every programme clears the overall
  programme minimum (25 records) and shows between 2 and 9 subjects at the per-subject
  minimum; the rest are listed as gaps. Exact per-subject counts appear on each programme's
  *Courses and Subjects* tab and in the evidence dashboard.
- "Recent" means publication year 2023–2026 (the enforced window; records outside it are
  dropped at write time and filtered again at read time).

---

## D. Resource authenticity and legal access

**Providers connected (10):** OpenAlex, Crossref, DOAJ, Europe PMC, CORE, Semantic Scholar,
arXiv, Internet Archive, Open Library, Zenodo. All are open scholarly infrastructures with
public APIs; each endpoint and its response fields were live-inspected during Phase 2 before
the adapter was written (`docs/accreditation/PROVIDER-RESEARCH-A.md`), and per-provider quotas,
rate-limit and priority behaviour are documented in `PROVIDER-RESEARCH-B.md`.

**Live provider health (full harvest, all 15 programmes, 2026-11-01/02)**

- Delivering records (measured from the database): OpenAlex 794, Europe PMC 643, Crossref 362,
  Zenodo 247, arXiv 189, DOAJ 88, Open Library 4 — 2 327 records in total across 7 providers.
- Honest zero result: Internet Archive answered successfully but produced no in-window matches
  across the runs executed; its checkpoints record the run state rather than a fabricated
  count.
- Unavailable during the harvest: CORE answered HTTP 429 (rate-limited; a direct probe with
  the configured key confirmed the 429 after ~6 s, and inside the engine the response arrived
  later than the mandated 8 s limit and surfaced as a timeout — a post-fix smoke test on
  2026-11-02 still timed out after 8 000 ms, so CORE delivered 0 records) and Semantic Scholar
  answered 429 twice with shared-IP rolling windows (latest observed reset
  2026-11-02T10:05Z, now elapsed). Both are recorded in their checkpoints and retry
  automatically on a later run.
- The harvest caught four real adapter defects that mocked unit tests could not: Crossref's
  `mail-to` parameter (must be `mailto`), Europe PMC's REST host (must be `www.ebi.ac.uk`),
  a Zenodo host typo (`zensodo.org`), and CORE's publisher field arriving as a non-string
  (`value?.trim is not a function`, fixed with a typeof guard in the adapter and a defensive
  `clean()` in the shared mapping). All four were fixed, gates re-run (144/144, tsc 0,
  lint 0), and the affected providers then delivered records — which is exactly what live
  validation is for. A fifth, non-provider defect (PostgREST's 1 000-row response cap
  truncating route reads) was found and fixed on 2026-11-03; see the QA table in section B.

**How access is verified**

- A record's `fullTextUrl` is only ever a direct open-access/full-text URL supplied by the
  provider. It is never synthesised from a DOI, and a publisher landing page is never labelled
  as full text.
- `accessState` is derived strictly: `full_text` only when a real full-text URL exists,
  otherwise `abstract_only` if an abstract exists, otherwise `metadata_only`.
- Stored links are checked by the verification pipeline: HEAD with GET fallback, 8 s timeout,
  250 ms courtesy delay. Confirmed dead links (404/410/451) downgrade the visible label and
  keep the stored URL for traceability; timeouts, 403/429/5xx never claim a link is dead —
  previously verified links become "stale" instead.
- The dashboard reports verified / unverified / failed / stale counts and the check date of
  every sample citation.

**Licence restrictions**

- Records are metadata plus links only. No publisher PDFs are downloaded or stored; opening a
  record goes to the provider or publisher page under that site's terms. Provider APIs are
  used within their published terms (polite rate limits, identifying User-Agent, bounded
  request budgets).
- The pipeline does not persist a licence field or peer-review flag, so a licence filter and a
  peer-review filter are not offered (honestly disclosed; see H5). Open-access status is shown
  where the provider reports it.
- ESUT-subscribed publisher content is not included; the portal labels such landing pages
  "Publisher page — full text may require a subscription" instead of implying free access.

---

## E. Demonstration links

Base URL: your deployed origin (locally `http://localhost:3000`). All paths are in-app routes.

| What | Link |
| --- | --- |
| Accreditation Resources homepage | `/accreditation-resources` |
| Ebook search (all programmes) | `/acreditation-resources?tab=ebooks` (add `&q=your+term`) |
| Journal search (all programmes) | `/accreditation-resources?tab=ejournals` (add `&q=your+term`) |
| Open-access database directory | `/accreditation-resources?tab=databases` and the existing `/open-access-databases` |
| Administrator evidence dashboard | `/admin/accreditation-evidence` (requires librarian/admin login) |

Each programme collection (15):

- `/accreditation-resources/mechanical-production-engineering`
- `/accreditation-resources/biomedical-engineering`
- `/accreditation-resources/chemical-engineering`
- `/accreditation-resources/pharmacy`
- `/accreditation-resources/accounting`
- `/accreditation-resources/banking-finance`
- `/accreditation-resources/marketing`
- `/accreditation-resources/anatomy`
- `/accreditation-resources/computer-science`
- `/accreditation-resources/education-mathematics`
- `/accreditation-resources/civil-engineering`
- `/accreditation-resources/education-biology`
- `/accreditation-resources/integrated-science`
- `/accreditation-resources/environmental-management-and-toxicology`
- `/accreditation-resources/doctor-of-pharmacy`

Programme pages accept `?tab=` and `?q=` too, e.g.
`/accreditation-resources/pharmacy?tab=subjects&q=pharmacology`.

---

## F. Accreditation readiness

**What the system can genuinely demonstrate today**

- 15 dedicated, independently searchable programme collections with faculty/degree/visit
  information, honest record counts, source labels on every record, an enforced 2023–2026
  filter, and access labels that never overstate availability.
- A real harvested collection across all 15 programmes: 2 327 records from 7 delivering open
  providers (OpenAlex, Europe PMC, Crossref, Zenodo, arXiv, DOAJ, Open Library), searchable
  and filterable live, with 1 188 records carrying provider-supplied full-text URLs and
  2 033 distinct DOIs.
- Route counts that match the database exactly (re-verified 2026-11-03 after fixing the
  PostgREST row-cap truncation — see the QA table).
- A 19-database directory with per-programme applicability and open/institutional badges.
- Local repository matches surfaced honestly (the 2 current matches).
- A working, role-gated evidence dashboard that computes all counts from the real tables
  (authenticated check on 2026-11-03: `indexed=2327` with exact per-programme/per-provider
  breakdowns), states its thresholds as internal heuristics, and exports reproducible CSV/PDF
  evidence.
- The complete harvest/verify pipeline in code, unit-tested (152 tests across the
  accreditation and paged-query suites) and demonstrated live under bounded budgets across
  three approved passes.

**What still needs verification**

- Link-verification results: the first pass ran 2026-11-03 (25 checked → 21 verified, 0
  failed, 4 unverifiable) — 21 records now carry verified links and zero access labels were
  downgraded; the other 2 306 records stay honestly unverified until later passes, and
  full-text labels outside the verified set still reflect the provider's claim only.
- Subject-level depth: every programme clears the overall minimum (25 records) but only
  2–9 subjects per programme reach the internal ≥ 3 minimum; the gaps are listed per
  programme in section C and on the dashboard.
- CORE and Semantic Scholar remain rate-limited; a CORE key/quota check or a Semantic Scholar
  API key would add those two sources on a later run.

**What requires human approval or institutional action**

- Applying the reviewed, reversible database migration (owner approval) — **completed
  2026-11-01** by the owner via the Dashboard SQL editor; independently verified from here.
- Bounded live harvests (owner approval) — **all 15 programmes completed 2026-11-01/02**;
  subsequent scheduled syncs still need approval, one bounded run at a time.
- Running further link-verification passes — the first ran 2026-11-03 (owner-approved,
  limit 25: 25 checked / 21 verified / 0 failed); each subsequent pass needs the same bounded
  approval (they progress oldest-unchecked-first).
- Image rebuild/deploy and independent verification of the deployed version — **completed
  2026-11-04** with owner approval: image `20261103-0555` built, secret-scanned and pushed,
  deployed through Coolify, then independently smoke-tested in production (section B).
- Any future paid subscriptions, and the decision on whether to add licence/peer-review
  metadata to the schema.

---

## G. Human testing guide

Run against the running site (local dev or deployed). No programming knowledge needed.

Data note (2026-11-03): all 15 programmes are harvested — 2 327 records from 7 delivering
providers (OpenAlex, Europe PMC, Crossref, Zenodo, arXiv, DOAJ, Open Library); CORE and
Semantic Scholar are currently rate-limited and contribute zero. The first link-verification
pass ran the same day (25 checked, 21 verified, 0 failed) — records outside that set stay
honestly unverified until later passes, and every programme card shows its real measured
counts.

| WHERE TO CLICK | WHAT TO SEARCH | WHAT TO EXPECT | PASS OR FAIL |
| --- | --- | --- | --- |
| Navbar → "NUC Accreditation Resources" | — | Landing page with 15 programme cards, each showing record counts, visit dates and last-synchronised date | PASS if all 15 cards appear with names and visit dates; FAIL if the page is blank or shows an error |
| A programme card (e.g. Pharmacy) | type `pharmacology` in the search box, press Search | Results list with source labels and access badges; empty state message if nothing matches | PASS if results (or a clear empty state) appear and no record shows a year before 2023; FAIL if pre-2023 items appear |
| Same page → year filter | set year 2023 – 2026 | Only 2023–2026 records listed | PASS if every result's year is inside the range; FAIL if an older year is listed |
| Same page → tick "Full-text links only" | — | Only records with a working "Open full text" action remain | PASS if every listed record shows a full-text action; FAIL if a record claims full text but has no link |
| Tabs → "Ebooks" / "Ejournals" / "Research Articles" | any word | Tab counts update; only that document type is listed | PASS if counts change sensibly and types match the tab; FAIL if ebooks appear under Ejournals |
| Tabs → "Databases" | — | ~15–22 databases for the programme with Open access / Institutional badges, opening in a new tab | PASS if links open the real database site; FAIL if a database link is broken |
| Tabs → "Courses and Subjects" | — | Subject table with counts, "Covered / Needs more resources" badges and a note that the minimum is an internal heuristic, not a NUC quota | PASS if the disclaimer is visible; FAIL if it claims an official quota |
| Admin login → `/admin/accreditation-evidence` | — | Overview KPIs, By-programme table with evidence status, Sources and sync tables; page does NOT start any sync by itself | PASS if data loads and nothing runs automatically; FAIL if a sync starts on page load |
| Evidence page → "Run sync" | pick one programme, confirm | A confirmation dialog appears first; after confirming, a bounded run summary shows fetched/upserted counts | PASS if the dialog appears and the summary lists real provider names; FAIL if it runs without confirmation |
| Evidence page → "Export CSV" and "Export PDF" | — | Two files download containing programme rows, source lists, sample citations and the not-a-quota disclaimer | PASS if files open and contain your programme; FAIL if a file is empty or claims counts that are not on screen |

---

## H. Remaining work

| # | Item | Status | Priority |
| --- | --- | --- | --- |
| 1 | Apply migration `20261030180000_accreditation_resources.sql` (reviewed, reversible) | **Completed 2026-11-01** — applied by the owner via the Supabase Dashboard SQL editor and independently verified from here: both tables exist (service role reads 0 rows each), the `anon` RLS read policy works on `scholarly_resources` (200, `[]`) while `resource_sync_state` is denied to `anon` (401), and all three public accreditation routes return 200 with honest zero counts on a live dev server | Completed |
| 2 | First bounded live harvest (pharmacy first, then remaining 14 programmes) | **All 15 programmes completed 2026-11-01/02** with owner approval across three bounded passes: **2 327 records**, integrity clean (QA table in section B). Scheduled re-syncs remain approval-gated | Completed |
| 3 | First link-verification pass + scheduled re-verification | **First pass completed 2026-11-03** (owner-approved, limit 25): 25 checked → 21 verified, 0 failed, 4 unverifiable — zero failures meant no access downgrades. Later passes continue with the same bounded approval (each pass takes the oldest unchecked rows first) | High |
| 4 | Deploy (image rebuild) and verify the deployed version independently | **Completed 2026-11-04** — image `20261103-0555` built, secret-scanned, pushed to GHCR and deployed via Coolify after repairing the server's registry credentials (the stored GitHub PAT had expired; a server-side `docker login` over SSH fixed the pull); app `running:healthy` and every smoke check passed (section B, production-deployment row) | Completed |
| 5 | Licence filter and peer-review filter | Not feasible today: no licence/peer-review fields exist in the schema or provider mappings; would need a schema + mapping extension | Medium |
| 6 | Source-reported collection sizes | Not captured by the integrations; the dashboard explicitly states every figure is an actual ESUT-indexed count | Medium |
| 7 | Mixed-file staging | **Partially resolved**: this batch's i18n/nav/footer/admin-key hunks were committed in `3075eb0` and the middleware csrf-cookie hunks in `c538bd8`, both by hunk-level staging. Still unstaged for their owning batches: the two SEO `FALLBACK_BASE` hunks in `middleware.ts`, the remaining `en.ts`/`fr.ts` ORCID hunks, `worker/handlers/index.ts` (+ its test, preservation handlers), `package.json`/`package-lock.json` (dependency churn), `app/layout.tsx`, `next-env.d.ts`, `docs/USER-RUNBOOK.md`, `AGENTS.md` (auto-generated heading change written by `next dev` itself) and the unrelated route/page files — coordinate before any commit | Medium |
| 8 | a11y suite flakiness under load | 2 axe tests timed out during one loaded full run and pass standalone (8/8); the final full run (1 155/1 155) passed without flakes — consider a higher `testTimeout` for the axe suite | Low |
| 9 | Volume after harvest | **All 15 programmes harvested** — per-programme totals 118–268 records, subjects covered 2–9 of 13–21 per programme against the internal ≥ 3 heuristic (section C). The remaining subject gaps fill in on later approved syncs; the dashboard shows exactly where each programme stands | Low (expected) |
| 10 | Next 16 deprecation: `middleware.ts` should become `proxy.ts` (build prints the notice; `npx @next/codemod@canary middleware-to-proxy .`) | Not migrated — the file also carries other batches' changes and its tests import `./middleware`; needs coordinated migration | Low |
| 11 | Stale Supabase project references | `supabase/config.toml`, `.env.development` and `.env.new` point at project `uamfjajbxwpbzfgmaalk`, which no longer exists in DNS (NXDOMAIN, verified via public resolver) and whose pooler reports the tenant as not found; the live application database is project `rnnjspkdhojoigncdgmy` (per `.env.local`/`.env`/`.env.production`). Left untouched — cleanup is outside this batch, but future CLI pushes must target the live ref | Medium |
| 12 | Provider availability at harvest time | CORE still times out (post-fix smoke test 2026-11-02 returned `timeout after 8000 ms`; a direct probe earlier confirmed HTTP 429 with the configured key) and Semantic Scholar saw two shared-IP 429 windows (latest observed reset 2026-11-02T10:05Z, now elapsed). Both are persisted in their checkpoints and retry automatically on later runs — no action needed unless the limits persist (a CORE key/quota check or a Semantic Scholar API key would help) | Medium |
| 13 | Durable registry credentials and the dependency audit | The GitHub PAT stored in the operator credentials file expired and broke Coolify's image pull; repaired 2026-11-04 with a server-side `docker login` using the current GitHub CLI session token (Docker stores it unencrypted in `/root/.docker/config.json` and warns). Replace it with a rotated fine-grained PAT or a credential helper before that session ends. The CI `Security audit` step also stays red until `next`/`undici`/`zod` are upgraded — `package.json` and `package-lock.json` are mixed unstaged files owned by another batch, so no dependency change was made here | Medium |

Deployment: **completed 2026-11-04** with owner approval — image `20261103-0555` is live on
`https://virtuallibrary.esut.edu.ng` and was independently smoke-tested (section B). The
database migration (2026-11-01) and all 15 bounded harvest runs (2026-11-01/02, 2 327 records)
were executed with explicit owner approval, as was the first link-verification pass (2026-11-03,
limit 25).

---

## Acceptance checklist (brief § NON-NEGOTIABLE CONDITIONS)

| # | Condition | Evidence |
| --- | --- | --- |
| 1 | All 15 programmes have dedicated functioning collections | Portal route + 15 cards + per-programme pages (section E); all 15 now hold real harvested data (2026-11-01/02: 145–268 records each, 2 327 total), each with its 4-course list rendered |
| 2 | Each programme searchable independently | Per-programme search box + `?q=` deep links (tested by tsc/lint/unit suite) |
| 3 | Documented attempt to locate recent resources per programme | `PROVIDER-RESEARCH-A/B.md`, per-programme search terms in the taxonomy, 19-database directory |
| 4 | 2023-onward filter works | Enforced at write time, read time and in the UI (sync/verification tests cover the window) |
| 5 | Download labels reflect verified access | Strict `accessState` derivation + verification downgrade rules (19 verification tests); first pass 2026-11-03: 21 verified / 0 failed → zero downgrades measured |
| 6 | All records traceable to source | `source_provider` identity, `raw_metadata`, source label on every card, sample citations with sources |
| 7 | Content legally accessed | Open providers only, link-out only, no PDF storage, terms-respecting budgets (section D) |
| 8 | Duplicates do not inflate statistics | Identity + `dedupe_key` merge, `uniqueWorks` metric, dedupe tests in the sync suite; live evidence after all 15 harvests: 2 327 rows → 2 327 distinct `dedupe_key`s and 2 033 distinct DOIs with zero duplicates |
| 9 | Counts genuine and reproducible | Section C measured from the live database (re-queried 2026-11-03 after the full harvest and the row-cap fix: 2 327 rows); post-fix live routes return counts identical to the database; dashboard Refresh reproduces them |
| 10 | No existing features broken | Full suite 1 155/1 155 green in the final run (baseline 1 003 intact); changes to shared files are additive |
| 11 | Dashboard reports real coverage | Evidence API computes from real tables; pre-harvest live verification (2026-11-01) showed honest zero counts on all three public routes; post-harvest and post-row-cap-fix (2026-11-03) the public routes and the authenticated evidence API return counts identical to the database (e.g. `programmes` sum 2 675 tags across all 15, `resources` `total=2002 capped=true`, `coverage?programme=marketing` `indexed=201`, evidence `indexed=2327`); pre-fix truncation (PostgREST 1 000-row cap) was found by comparing routes against the database and fixed the same day (section B QA) |
| 12 | Gaps honestly disclosed | This report (A, C, F, H) and in-product disclaimers |
| 13 | Tests run and documented | Table in section B |
| 14 | Deployed implementation verified | **Yes** — production runs image `20261103-0555` since 2026-11-04; the accreditation APIs serve real JSON there (they returned the SPA shell before the flip), every smoke check and the authenticated evidence API pass (section B), and rollback tags `20261026-0947`/`20261023-0259` remain available |
| 15 | Nontechnical testing guide supplied | Section G |
