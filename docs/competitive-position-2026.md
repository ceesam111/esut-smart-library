# ESUT Library Competitive Position

## Versions Compared

Koha: **26.05.03** (latest stable patch of the 26.05 series; 24 Aug 2026)
DSpace: **10.0** (latest stable; June 2026)
ESUT commit: **`2625abb`** (production container `esut-app-new`, live https://virtuallibrary.esut.edu.ng)

Comparison date: 2026-09-28. Full evidence matrices: `docs/current-koha-comparison.md`, `docs/current-dspace-comparison.md`.

## Where ESUT Is Clearly Ahead of Koha

1. **Integrated IR + CRIS** — Koha has no institutional repository and no CRIS. ESUT ships communities/collections/items, researcher entities, and thesis supervision in the same deployment (`repository_*`, `researchers`/`researcher_grants` tables). Scope advantage, not a Koha defect.
2. **Native thesis supervision workflow** — student → supervisor review (`/api/repository/supervisor-review`) → librarian approve → publish, with supervisor assignment. No native equivalent in Koha.
3. **14-source federated scholarly discovery** — in-process adapters for Google Books, OpenAlex, Crossref, DOAB, DOAJ, Unpaywall, PubMed etc. (`src/server/resources/adapters.ts:444`) spanning catalogue + repository. Stock Koha OPAC searches its own catalogue. **Caveat: owner reports production search currently returns only OpenLibrary results (#4) — advantage is architectural, not yet proven in production.**
4. **AI reference librarian + typed worker agents** — `/api/ai/reference-librarian` (rate-limited provider router, 6 agent prompts, voice) plus 7 DB-queued job types with atomic claim (`agent_jobs`). Koha has no native AI assistant (community plugins only). **Caveat: workers reported failing (#19); no tool-calling/RAG yet.**
5. **Student engagement platform** — QR digital library card, blog, events, forum, wellbeing resources, unified identity with patrons/staff/researchers in one auth layer. Outside Koha's product scope entirely.

## Where ESUT Is at Parity with Koha

True production-equivalent parity is narrow — ESUT's implementation differs but both deliver substantially equivalent function:

- **Self-registration with policy controls** (`/api/registration/*` vs OPAC self-registration)
- **RBAC concept** (`requireRole` + feature flags vs Koha permission modules) — different machinery, comparable effect
- **Offline circulation capture** (concept-level; ESUT's server sync route exists with tests but has 0 frontend callers — parity of design, not of wiring)
- **CSV import of patrons/catalogue** (CSV wizards both)
- **QR/barcode labels** (CODE128 labels vs Koha's label/barcode generation — ESUT's desk scanning itself is broken per #14)
- **JWT REST auth** (Bearer tokens both)

No core ILS depth area (cataloguing, acquisitions, circulation maturity, notices, reporting, serials) reaches parity.

## Where ESUT Is Still Behind Koha

Across **every** core ILS depth dimension:

1. **Cataloguing** — no MARC parser/validator/frameworks/overlay/batch edit; server `marc.ts` is export-only with 0 production callers; real MARC handled by duplicated client code.
2. **Acquisitions depth** — schema complete but no line-level receiving UI, no budget encumbrance, no claims, no tax/shipping; `edi.ts` is a test-fixture X12 generator (SE count overstated, no EDIFACT).
3. **Circulation maturity** — no due-date calendar, no transfers, no lost-item workflow, loan rules hard-coded; owner reports checkout/barcode and hold flows broken (#13/#14); SIP2 code exists but has **no listener, no flag, and password check is a non-blank comparison** — dead code, not a service.
4. **Reporting & notices** — report writer is safe (PostgREST-only, SQLi-immutable) but weaker: 5 canned types, no saved reports, no scheduling (local toggle), 0 UI callers, serials branch references a nonexistent column (runtime error); notices module has 0 production callers while email is inline-scattered; **analytics `recordEvent` has 0 callers — the live dashboard reads an effectively empty table**.
5. **Ecosystem maturity** — 20+ years, thousands of deployments, plugin system, 40+ translations, OpenAPI-documented REST, SAML/LDAP/CAS/OIDC auth options, security release cadence. ESUT: single deployment, ~months old, no CI test gate, lint config broken, **64 TypeScript errors**, production DB effectively empty (12 catalogue items, 2 patrons, 0 loans).

Also behind: SRU server (no CQL), authority control (keyword table, not MARC authorities), serials pattern engine, multilingual (i18n built but unwired), POS/multi-currency/ERM (absent), ILL (owner reports submit broken, #3), course-reserve depth, stocks/transfers/inventory/recalls.

## Where ESUT Is Clearly Ahead of DSpace

1. **Full ILS operations alongside the repository** — circulation, patrons, acquisitions, serials, fines in one deployment. DSpace is repository-only by design (not a DSpace weakness).
2. **Native thesis supervision chain** — supervisor review step without extra modules/configuration.
3. **14-source federated OA discovery across catalogue + IR** — same production-behavior caveat as above (#4).
4. **AI librarian + 7 worker agent types** — no DSpace equivalent; workers unproven (#19).
5. **Unified engagement layer** — QR card, blog/events/forum/wellbeing, cross-module notifications, domain webhooks outbox, one identity for patrons + researchers — all outside DSpace scope.

(DSpace-side note: subscribed-databases directory with overlay = small genuine extra vs stock DSpace External Search.)

## Where ESUT Is at Parity with DSpace

- **Sitemap + robots.txt** (live `/sitemap.xml`, 149 entries)
- **Basic deposit → review → publish status flow** vs DSpace collection workflow (parity of outcome only; DSpace's engine is far richer — count as PARTIAL leaning parity)
- **DTO-style JSON-LD context** on repository routes (shallow both)
- **CSV export of items**
- **DOI minting via external provider** (Zenodo vs DataCite) — both EXTERNAL-CREDENTIALS REQUIRED, neither production-verified here
- **Webhook outbox concept** (repository_webhooks with tests vs DSpace events)

## Where ESUT Is Still Behind DSpace

Every core IR dimension:

1. **Object model** — single `file_url` per item vs DSpace bundles/bitstreams; **multi-file deposit impossible** (most fundamental gap).
2. **Discovery depth** — client-side facets, no full-text (Tika-equivalent) extraction, no Google Scholar/highwire citation tags, no spellcheck vs production Solr.
3. **Preservation** — `exportItemAIP()` writes a `.txt` pseudo-bag with no payload copy; `runFixityVerification()` has zero scheduled callers; no withdraw/tombstone (delete loses archival trail).
4. **Workflow engine** — a status column + `reviewer_id` vs claim/return/unclaim stepwise review with audit.
5. **Standards breadth** — OAI serves oai_dc only (live but returns 0 records from an empty repo, embargo/visibility not filtered, header double-wrap bug); ResourceSync/Signposting/SWORD deposit/COUNTER-SUSHI are builders-only or absent though some were labeled "Deployed"; metadata registry, crosswalks, IIIF, SUSHI all absent.

Plus: Handle resolution (column exists, no handle server), per-object resource policies (3 coarse visibility states), auth providers (no SAML/LDAP), ORCID/ROR lookups built but zero UI callers.

## Where ESUT Combines Capabilities Neither Platform Provides Together

Only claims where data/workflows genuinely connect (verified):

- **ILS + IR + CRIS in one identity layer** — a patron can be checked out from, deposit to, and be researched by the same account system (`requireUser`/`requireRole` over shared Supabase auth + 125/125 RLS-enabled tables). Real, but researcher models are duplicated (`patrons` vs `researchers`), so integration is partial.
- **Thesis chain across repository + researcher CRIS + notifications** — supervisor assignment feeds publication workflow and notification tables. Real.
- **Catalogue + repository unified search endpoint** (`/api/search/resources`) — real route, but production returns only one source (#4).
- **AI librarian candidate for catalogue/circulation/repository** (4 agent prompts) — prompts exist; no tool-calling, so not yet one integrated workflow.
- **Unified analytics intent** — architecture exists (eventRecorder → analytics_events → admin dashboard) but **zero event capture is wired**; currently NOT an integrated workflow.

Not genuinely integrated (several features merely co-located): B2 storage (unused by frontend), usage-statistics builders, course_reserves tables (dead; real flow is course_reading_lists), offline-circulation sync route (no UI caller), i18n (no callers).

## Features That Exist But Still Lack Real-World Validation

"Implemented but not yet production-proven" list:

- **OAI-PMH** — deployed (LEVEL 4) but harvests 0 records and was never tested with an external harvester (never reached LEVEL 5).
- **SRU server** — deployed, responds with valid SRW XML, no external client interoperability, no CQL.
- **Z39.50** — relabelled Open Library proxy; protocol absent (LEVEL 1 at best).
- **SIP2** — code + 3 tests, no listener, insecure auth, no hardware ever connected (LEVEL 1–2).
- **EDI (X12)** — generator + vacuous literal tests, no supplier exchange ever (LEVEL 1).
- **SWORD** — service document only (LEVEL 1).
- **ResourceSync / Signposting** — builders + tests, zero endpoints wired (LEVEL 1).
- **COAR Notify** — inbox deployed (LEVEL 4) but accepts **unauthenticated POSTs (live-proven 201)** and was never exchanged with a real agent (below LEVEL 5).
- **DOI/Zenodo** — code complete, credential-gated, zero DOIs minted (LEVEL 1).
- **ORCID/ROR lookups** — proxies + tests, zero UI callers (LEVEL 2).
- **COUNTER/SUSHI** — COUNTER builder unwired, SUSHI endpoint doesn't exist (LEVEL 1 / ABSENT).
- **Worker agents** — deployed but reported failing (#19).
- **Offline circulation sync route** — tested server-side, no UI path.
- **Analytics dashboard** — deployed but reads an empty table (no event capture wired).
- **Federated search** — deployed but production-broken (#4).
- **AIP/BagIt/RO-Crate** — builders + tests, no delivery routes (LEVEL 1–2).

## Newly Discovered Gaps

Not on the old gap list (or newly proven):

1. **KBART endpoint always HTTP 500** — `requireRole(new Request('http://localhost'))` synthetic request makes auth fail unconditionally (live-verified `KBART status=500`).
2. **COAR Notify inbox has no authentication** — anonymous POST returns 201 (live-verified; probe rows deleted afterwards).
3. **`docs/standards-conformance.md` does not exist** — Section E deliverable referenced by audits is missing.
4. **Public storage buckets (`repository`, `theses`, AIP bucket) with public=true** — embargo/restricted files would leak by URL once content exists; OAI ignores embargo too.
5. **`recordEvent` (analytics capture) has zero callers** — analytics advantage unsubstantiated; table empty in production.
6. **SIP2 `authenticate()` accepts any non-blank password** for any librarian row — insecure dead code that must never be enabled as-is.
7. **6 test files under `app/**/route.test.ts` are excluded by `vitest.config.ts`** — they never run in CI/locally via config.
8. **CI has no test/tsc gate** — only Docker build; regressions ship freely.
9. **`npm audit --omit=dev` = 22 vulnerabilities (1 critical, 8 high)** — criticals are Next.js advisories (image-optimizer DoS, RSC deserialization, request smuggling, disk cache); next range fix exists upstream.
10. **`next.config.mjs` sets `ignoreBuildErrors: true`** — build success does not imply type correctness.
11. **Hot-table index gaps** — live DB: `circulation_transactions`/`reservations`/`fines`/`payments` each have only 1 index; 7 circulation FK columns have no covering index; `repo OAI/filter` path unindexed at scale.
12. **`docs/api.md` documents 23 of 82 route files** (59 undocumented) — and now `kbart` 500s despite being "documented".
13. **Report writer `serials` branch queries nonexistent `end_date` column** — runtime failure if ever called.
14. **Production DB effectively empty** (12 catalogue items, 2 patrons, 0 loans, 0 repository items, 0 IR items) — no operational maturity data exists at all.

## Technical Debt Created During Waves 0–6

- **64 TypeScript errors total** (all legacy `src/app-pages`/`src/components`, 0 in new-wave dirs; ~63 traceable to one `as const` pattern in `institution.config.ts:73`; build passes only because `ignoreBuildErrors=true`).
- **Lint unusable** — no working ESLint config (pre-existing; lint gate absent).
- **Broken/dead production code**: KBART 500, ILL submit (#3), overdue worker (#19), serials report column, `circulation/notices.ts` (0 callers), `eventRecorder` (0 callers), `marc.ts` (0 production callers), offline-sync route (0 UI callers), ORCID/ROR proxies (0 callers), B2 service (0 frontend callers), suggestions table (0 refs).
- **Vacuous tests** — `edi.test.ts` asserts literal strings without invoking the generator; `versions.test.ts` has no assertions; route-test files excluded from vitest config.
- **Duplicated logic** — MARC generation exists both server-side (`src/server/catalogue/marc.ts`) and client-side (`admin/Catalogue.tsx`); two researcher models (`patrons` vs `researchers`); two IR schemas (`repository_*` vs `ir_*`).
- **Overstated docs** — `implementation-progress.md` marked WAVE 4 "All complete" (POS absent, multi-currency absent, SIP2 "behind flag" with no flag) and WAVE 5 "Deployed" (ResourceSync/Signposting/OpenURL unwired); corrections applied during this audit.
- **Feature flags permanently bypassed** — `SIP2_ENABLED`/`Z3950_ENABLED` never read; `scheduleMonthly` is local state only.
- **Scheduler idempotency issues** in worker (`worker/scheduler.ts`), console.error fallbacks in public data path (added for visibility, `getPublicDirectory` catch).
- **Security**: npm criticals (Next.js), public buckets, COAR open inbox, SIP2 auth, AI endpoints use in-memory rate limiting (per-instance only), middleware `sensitivePrefixes` doesn't cover generic `/api/admin` (guards rely on per-route `requireRole` — works, but inconsistent).

## Most Important Next Engineering Priorities

1. **P0 correctness/security**: fix KBART 500 (one-line auth fix); requireRole on COAR inbox; fix owner-reported #3 (ILL submit), #13/#14 (checkout/holds/barcode), #19 (workers); add CI gates (tsc + vitest + build, remove `ignoreBuildErrors` after debt burn-down); upgrade Next.js past critical advisories; make repository/AIP buckets private with signed URLs; never enable SIP2 until listener+auth fixed.
2. **P0/P1 truth-telling**: finish correcting `implementation-progress.md` wave statuses (this audit).
3. **P1 competitive core**: canonical bundles/bitstreams file model; server-side facets + Scholar citation tags; real AIP payload + scheduled fixity; OAI fixes (embargo/visibility filter, double-wrap, sets) + external-harvester validation; wire analytics event capture; fix federated multi-source production search (#4); wire notices → overdue email job; COUNTER checkbox + SUSHI; ResourceSync/Signposting endpoints; Z39.50 real client (yaz) + SRU CQL.
4. **P1 platform**: burn down 64 TS errors (one-pattern fix for ~63), lint config, document 59 missing API routes/OpenAPI, fix report-writer serials column + wire report UI, DB-driven loan rules + calendar, SSO (SAML/OIDC), DB hot-table index pass.
5. **P2**: MARCXML ingestion/validation, ILL lifecycle, serials pattern engine, withdraw/tombstone, per-object policies, batch metadata edit, SWORD deposit, ERM model (only if e-resource management is required).
