# Production Maturity Matrix

Audit date: 2026-09-28 · ESUT commit `2625abb` · live https://virtuallibrary.esut.edu.ng (container `esut-app-new`, healthy, Up 4h; `esut-worker` Up 31h)

Purpose: make it impossible to confuse **implementation** with **operational maturity**.

Level key (Section F of the audit spec):
- **L0** — UI/demo only
- **L1** — code implemented
- **L2** — automated tests pass (in the configured suite)
- **L3** — running locally/staging
- **L4** — deployed production endpoint
- **L5** — interoperated successfully with an independent external implementation

Column semantics:
- **Tests**: runs under configured `vitest` (`include: ['src/**/*.test.ts','worker/**/*.test.ts']`). Route tests under `app/**` are **excluded by config** and never run in the suite.
- **Production usage**: real data/transactions observed in the hosted database or by the institution — not deployment alone.

| Feature | Implemented | Tests | Deployed | External interoperability tested | Production usage | Status |
|---|---|---|---|---|---|---|
| OAI-PMH | ✅ `app/api/oai/route.ts` (Identify/ListIdentifiers/ListRecords/oai_dc, resumption) | ⚠️ `app/api/oai/route.test.ts` exists but **excluded from vitest config** (never runs in suite) | ✅ live, p50 ≈ 360ms | ❌ never harvested by an external tool; embargo/visibility filters missing; header double-wrap bug in code; `deletedRecord=no` | ❌ **0 records** (`repository_items`=0) | **L4** — deployed but unvalidated |
| SRU server | ✅ SRW XML envelope + Explain + diagnostics (`app/api/sru/route.ts`) | ⚠️ `app/api/sru/route.test.ts` **excluded from config** | ✅ live (explain p50 ≈ 326ms, search p50 ≈ 431ms) | ❌ no external SRU client used; **no CQL** (Postgres `websearch` fallback) | ❌ only self-probes | **L4** — deployed, non-CQL |
| Z39.50 | ❌ **protocol absent** — Open Library REST relabelled ("Z39.50 proxy" comment `CatalogueNew.tsx:312`) | ❌ none for a client | ❌ no endpoint (client-side button only) | ❌ n/a | ❌ n/a | **L1** (proxy only) — **BEHIND, honest label** |
| SIP2 server | ⚠️ parser+message codecs (`src/server/sip2/`), **no TCP listener, no flag; password check = non-blank** | ✅ `server/sip2/sip2.test.ts` runs in suite | ❌ not deployable as a service | ❌ no self-check hardware ever connected | ❌ none | **L2**, insecure — **must not be enabled as-is** |
| EDI | ⚠️ X12 850 outbound generator only (`edi.ts`); no EDIFACT, no parser, no responses | ⚠️ `edi.test.ts` runs but asserts literals **without invoking the generator** (vacuous) | ⚠️ `/api/acquisitions/edi` deployed, **0 UI callers** | ❌ no supplier exchange ever | ❌ none | **L1** — test fixture, not production EDI |
| Multi-currency | ❌ absent (NGN hard-coded) | n/a | n/a | n/a | n/a | **L0** |
| POS | ❌ absent (fine payments only) | n/a | n/a | n/a | fine payments exist (small) | **L0** for POS proper |
| SWORD | ⚠️ service document route only; **no deposit endpoint** | ✅ `server/interoperability/sword.test.ts` runs | ⚠️ service-doc endpoint deployed | ❌ no external SWORD client | ❌ none | **L4** (doc) / **L1** (deposit) |
| ResourceSync | ⚠️ builders (`resourcesync.ts`) + test | ✅ test runs in suite | ❌ **no endpoint exposes it** (progress-doc "Deployed" claim corrected) | ❌ | ❌ | **L1** |
| Signposting | ⚠️ builders (`signposting.ts`) + test; no `Link` headers served anywhere | ✅ test runs | ❌ no endpoint | ❌ | ❌ | **L1** |
| OpenURL | ⚠️ builder + test | ✅ `openurl.test.ts` runs | ❌ no endpoint | ❌ | ❌ | **L1** |
| COAR Notify | ✅ inbox + 2 vocab types (`/api/coar-notify/inbox`) | ✅ `coar-notify.test.ts` runs | ✅ live | ❌ no real agent exchange; **⚠️ security: anonymous POST = 201 (live-proven, probes deleted)** | ❌ none | **L4** — deployed, **unauthenticated** |
| KBART | ⚠️ generator works (`kbart.ts`) | ✅ `kbart.test.ts` runs (builder only) | ❌ **route always HTTP 500** (synthetic-Request auth bug, live-verified) | ❌ | ❌ | **L0** as endpoint (broken) |
| DOI (Zenodo path) | ✅ credential-gated deposit code | ✅ identifiers tests run | ⚠️ env-gated | ❌ **zero DOIs minted** | ❌ none | **L1** — EXTERNAL CREDENTIALS REQUIRED |
| DataCite direct | ❌ not integrated (Zenodo proxies) | n/a | n/a | ❌ | ❌ | **L0/L1** |
| Handle resolution | ⚠️ `handle` column only; **no handle server** | n/a | ❌ | ❌ | ❌ | **L0–L1** |
| ORCID | ⚠️ public lookup proxy `/api/cris/orcid` | ⚠️ `app/api/orcid/route.test.ts` **excluded from config** | ✅ proxy deployed | ❌ lookup only; no OAuth/verified records/sync | ❌ **0 UI callers** | **L4** (proxy) / **L1** (feature) |
| ROR | ✅ org lookup proxy | ✅ `ror.test.ts` runs | ✅ | ❌ lookup only | ❌ **0 UI callers** | **L2–L4** (proxy), feature unwired |
| COUNTER | ⚠️ `counter.ts` builder + test | ✅ runs | ❌ **display unwired** (progress-doc claim corrected) | ❌ not validated by COUNTER regime | ❌ | **L1** |
| SUSHI | ❌ **endpoint does not exist** | ❌ | ❌ | ❌ | ❌ | **L0** |
| MARC21 export | ✅ `src/server/catalogue/marc.ts` (JSONB→MARCXML/JSON) | ✅ runs | ⚠️ route/library deployed but **0 production importers** (client duplicates logic) | ❌ export-only, no ingest/validation | ❌ none | **L2** — unused |
| MARCXML/ISO2709 ingest | ❌ absent | ❌ | ❌ | ❌ | ❌ | **L0** |
| AIP export | ⚠️ `.txt` pseudo-bag, **no payload copy** | ✅ `aipExport.test.ts` runs | ❌ no delivery route | ❌ | ❌ | **L1** — mislabeled vs DSpace AIP |
| Fixity verification | ⚠️ query function exists, **zero scheduled callers** | ✅ `checksum.test.ts` runs | ❌ never scheduled | ❌ | ❌ | **L1** |
| BagIt / RO-Crate builders | ✅ builders (tests per WAVE 2) | ✅ | ❌ no routes | ❌ | ❌ | **L1** |
| Withdraw/tombstone | ❌ absent (hard delete possible) | ❌ | ❌ | ❌ | ❌ | **L0** |
| Offline circulation | ⚠️ server sync route + UI localStorage queue | ⚠️ `app/api/circulation/offline-sync/route.test.ts` **excluded from config** | ✅ route deployed | ❌ | ❌ **0 UI callers wired to sync** (queue used locally) | **L4** (route) / **L0** (workflow end-to-end) |
| Notices (overdue/hold email) | ✅ `notices.ts` generator | ✅ runs | ⚠️ deployed but **0 production callers**; email inline-scattered; Resend blocked (domain unverified) | ❌ | ❌ nobody emailed | **L2** |
| Analytics capture | ⚠️ `recordEvent` **0 callers** — capture not wired | ✅ (schema/logger tests) | ⚠️ dashboard + `/api/admin/analytics` deployed | ❌ | ❌ `analytics_events` effectively empty | **L4** (read path) / **L0** (capture) |
| Federated search (14 adapters) | ✅ `adapters.ts` (14 adapters verified in code) | ✅ 4 adapter test files run | ✅ deployed | ⚠️ calls external APIs, but **production behavior broken (#4): only OpenLibrary results reported** | ⚠️ search used; results degraded | **L4** — advantage unproven |
| Catalogue FTS | ✅ GIN tsvector + weights | ✅ migration-era tests | ✅ | n/a | ⚠️ 12 items only | **L4**, untested at scale |
| Worker agents (7 types) | ✅ queue + atomic claim + scheduler | ✅ (worker tests in suite) | ✅ containers up | n/a | ❌ **owner reports all failing (#19)** | **L4** — not operationally reliable |
| AI reference librarian | ✅ chat endpoint + provider router | ✅ 3 AI test files run | ✅ | ❌ no tool-calling/RAG; no benchmark | ⚠️ manual chats only | **L4** — prompt-only |
| Report writer | ✅ 5 canned types, PostgREST-only | ✅ `reportWriter.test.ts` runs | ⚠️ endpoint deployed, **0 UI callers**; serials branch queries nonexistent column (runtime error) | n/a | ❌ none | **L2–L4** — unwired |
| ILL | ⚠️ table + patron form; **no API route; submit broken (#3)** | ❌ | ⚠️ UI deployed | ❌ | ❌ broken | **L0–L1** |
| Circulation (checkout/checkin/renew) | ✅ flows in `admin/Circulation.tsx` | ⚠️ partial (rule logic tests) | ✅ | n/a | ❌ **0 loans in DB; owner reports broken flows (#13/#14)** | **L4** deployed, **not operationally proven** |
| Self-registration | ✅ 7-route flow + policy | ✅ (validation tests) | ✅ | n/a | ⚠️ admin/staff accounts exist (2 patrons total) | **L4** |
| Directory of subscribed DBs | ✅ (this session's feature) | ✅ `directory.test.ts` runs | ✅ live, no-store verified E2E | ⚠️ overlay links only where source supports them | ✅ 7 databases live | **L4**, small real usage |
| COAR/ResourceSync/Signposting "Deployed" claims | — | — | — | — | — | **claims corrected in `implementation-progress.md`** |

## Environment / pipeline reality

| Check | Result (run this audit) |
|---|---|
| `tsc --noEmit` | **64 total errors** (all legacy `src/app-pages`/`src/components`; 0 in new-wave dirs; ~63 from one `as const` pattern; build passes only via `ignoreBuildErrors:true`) |
| `vitest run` | **141 passed, 0 failed, 0 skipped across 43 files** — but **6 `app/**/route.test.ts` files are excluded by config** and never run (oai, sru, orcid, authorities, licenses, offline-sync) |
| `next build` | exit **0** (with `ignoreBuildErrors:true`) |
| lint | **not runnable** — no working ESLint config (pre-existing) |
| `npm audit --omit=dev` | **22 vulnerabilities: 1 critical, 8 high, 10 moderate, 3 low** (criticals = Next.js advisories) |
| CI (`.github/workflows/docker-build.yml`) | Docker build only — **no test/tsc gate** |
| Migration/DB check | Hosted DB: **125 tables, 125 RLS-enabled, 0 tables without RLS, 0 policy-less RLS tables**, 327 indexes; hot tables thin (`circulation_transactions`/`reservations`/`fines`/`payments` = 1 index each; 7 circulation FK columns uncovered) |
| Container health | `esut-app-new` **healthy (Up 4h)**, `esut-worker` Up 31h, coolify stack healthy |
| Live endpoint probes (20 req each) | health, OAI Identify, SRU explain/search, catalogue, repository, sitemap, directory: **all HTTP 200**; p50 ≈ 280–430ms, p95 ≈ 450–620ms (includes internet RTT from this machine) |
| Negative probes | `directory=bogus` → 400 ✅; unauth admin → 401 ✅; **KBART → 500 ❌ (bug)**; **COAR anonymous POST → 201 ❌ (security bug)** |
| Interop tests (external) | **none achieved this audit** — no feature reached L5 |

## Bottom line

No feature currently reaches **LEVEL 5**. Deployed-and-probed features top out at **L4 with caveats** (OAI, SRU, COAR). The features with real production usage are limited to: admin/staff login, directory browsing (7 DBs), catalogue browsing (12 demo items), and health/OPAC pages — **loans = 0, repository items = 0, IR items = 0, analytics events ≈ 0**. The platform is deployed and healthy but **operationally pre-launch**; maturity claims must be read accordingly.
