# Top Remaining Gaps — Prioritized Engineering Backlog

Prioritized for **ESUT's university-library requirements** (a Nigerian university library running one integrated system: lending desk, patron self-service, collections, e-resources, theses, research support) — not because Koha/DSpace happens to have the feature.

Priority key:
- **P0** — critical correctness/security/interoperability issue
- **P1** — important competitive/maturity gap
- **P2** — valuable enhancement
- **P3** — optional/niche enhancement

Evidence: audit date 2026-09-28, commit `2625abb`, matrices `docs/current-koha-comparison.md` / `docs/current-dspace-comparison.md`.

---

## P0 — Critical (fix before any further feature work)

### 1. KBART endpoint returns HTTP 500 unconditionally
- **Competitor**: Koha (serials KBART exports)
- **Current ESUT state**: `app/api/serials/kbart/route.ts` calls `requireRole(new Request('http://localhost'))` — synthetic request → always `'Authentication required.'` (live-verified 500).
- **Exact missing capability**: working authenticated KBART export for subscription knowledge bases.
- **Reason**: a documented, advertised endpoint is 100% broken; silent API rot.
- **Architecture impact**: none — one-line fix (forward real `Request`, split auth from handler).
- **Dependencies**: none.
- **Recommended implementation**: pass the incoming request; add route-test (and fix vitest include so it runs).

### 2. COAR Notify inbox accepts unauthenticated writes
- **Competitor**: DSpace (signature-verified COAR-notify inbox).
- **Current ESUT state**: `POST /api/coar-notify/inbox` returned **201 for an anonymous probe** (rows deleted post-test); no `requireRole`, no signature verification, no vocabulary validation.
- **Exact missing capability**: authenticated (and ideally signature-verified) notification intake.
- **Reason**: open write endpoint = spam/pollution/audit-trail forgery on a public production API.
- **Architecture impact**: small — add `requireRole` (or verify HTTP Signatures) + schema validation before insert.
- **Dependencies**: none (auth exists).
- **Recommended implementation**: reject unauthenticated posts immediately; validate against COAR vocab; log source.

### 3. Owner-reported broken core flows: ILL submit (#3), checkout/holds/barcode (#13/#14), workers (#19)
- **Competitor**: Koha (production circulation/ILL), both (operations).
- **Current ESUT state**: `ILLRequest.tsx` inserts directly to supabase (no API route; submit broken per owner); desk checkout/hold flows broken; overdue worker reported failing.
- **Exact missing capability**: functioning desk circulation + ILL + scheduled jobs — the daily operations of a library.
- **Reason**: without these the platform is not an operational ILS regardless of parity scores.
- **Architecture impact**: medium — repair in `admin/Circulation.tsx`, add missing `/api/ill` route with `requireRole`, worker idempotency fix.
- **Dependencies**: repro cases from owner.
- **Recommended implementation**: reproduce → fix → regression tests → deploy → owner re-verify.

### 4. Restricted/embargoed full text can leak through public buckets
- **Competitor**: DSpace (resource policies gate files + harvesting).
- **Current ESUT state**: Storage buckets `repository`, `theses` (and AIP bucket) are public=true; OAI query ignores `embargo_until`/visibility; Signposting/ResourceSync not wired (so currently un-leaking only because unimplemented).
- **Exact missing capability**: private storage + signed URLs + embargo enforcement on every read path (API, OAI, future RS/Signposting/AIP).
- **Reason**: a thesis under embargo reachable by direct URL is a confidentiality failure in a university setting.
- **Architecture impact**: medium — private buckets, signed-URL issuance, embargo check in OAI + download routes (B2 path already drafted in `B2Service.ts`).
- **Dependencies**: bucket policy change (external console).
- **Recommended implementation**: flip buckets private → serve via authenticated/signed route → apply embargo filter everywhere → test with a seeded embargoed item.

### 5. CI has no quality gate; build ignores type errors
- **Competitor**: both (upstream projects gate releases).
- **Current ESUT state**: `.github/workflows/docker-build.yml` builds only; `ignoreBuildErrors:true`; lint config broken; 6 `app/**/route.test.ts` files excluded from `vitest.config.ts` (never run).
- **Exact missing capability**: enforced tsc/test/lint gate on every push.
- **Reason**: regressions ship silently — exactly how KBART 500 shipped.
- **Architecture impact**: small config changes, then a burn-down loop.
- **Dependencies**: TS debt burn-down (§P1.7) to flip `ignoreBuildErrors` off.
- **Recommended implementation**: workflow steps: `tsc --noEmit` (baseline-fail), `vitest run` (after fixing include glob), `next build`; remove ignore flag once baseline=0.

### 6. Next.js critical security advisories unresolved
- **Competitor**: both (patch cadence).
- **Current ESUT state**: `npm audit --omit=dev` → **22 vulns (1 critical, 8 high, 10 moderate, 3 low)**; criticals include image-optimizer DoS, RSC deserialization, request smuggling (next 9.3.4-canary–16.3.0-preview range).
- **Exact missing capability**: dependency versions without known CVEs.
- **Reason**: internet-facing app on a version with request-smuggling/DoS advisories.
- **Architecture impact**: upgrade (14.2.x → patched release line) + regression run of gates.
- **Dependencies**: gate to detect regressions (§5).
- **Recommended implementation**: upgrade to latest stable Next in current major or next supported major; re-run full gate + smoke on live.

### 7. Worker/scheduler reliability (#19)
- **Competitor**: Koha (cron-driven jobs, proven).
- **Current ESUT state**: 7 job types + atomic claim exist, but owner reports all workers failing; scheduler idempotency gaps; no dead-letter visibility.
- **Exact missing capability**: jobs that actually run repeatedly and safely in the container.
- **Reason**: overdue reminders, harvest refresh, fixity — all scheduled features — are dead without this.
- **Architecture impact**: medium — scheduler run-keys/idempotency keys, error surfacing (log table + admin view).
- **Dependencies**: none.
- **Recommended implementation**: fix failure root cause, add per-run idempotency token, admin status page.

---

## P1 — Important competitive/maturity gaps

### 8. Canonical repository object model (bundles/bitstreams)
- **Competitor**: DSpace (bundles/bitstreams, multi-file core).
- **Current ESUT state**: `repository_items.file_url` single file; flagged `[ ]` in WAVE 1 of `implementation-progress.md`; still not done.
- **Exact missing capability**: multiple files per item, file-level metadata/permissions/versions.
- **Reason**: theses need thesis PDF + supplementary data + appendices; blocks embargo-per-file, fixity-per-file, DSpace-level preservation.
- **Architecture impact**: **large** — new tables + migration + upload path + all readers (OAI, AIP, UI) must move; do before more deposits accumulate.
- **Dependencies**: bucket privacy (§4) so migration handles real URLs once.
- **Recommended implementation**: `bundles`/`bitstreams` tables (checksum, mime, size, visibility, embargo), dual-read period, backfill single-file items.

### 9. Fix production federated search (#4) + server-side facets
- **Competitor**: both (Koha ES/Zebra facets, DSpace Solr).
- **Current ESUT state**: 14 adapters exist but owner reports production search returns only OpenLibrary results; facets computed client-side; `/api/search/resources` requires auth (public search degraded).
- **Exact missing capability**: multi-source results with ranking + server aggregations with counts; public catalogue search.
- **Reason**: discovery is the library's front door; current behavior makes the biggest architectural advantage invisible.
- **Architecture impact**: medium — merge/rank pipeline, materialized facet counts or SQL GROUP BY, make search route public-safe.
- **Dependencies**: none.
- **Recommended implementation**: reproduce #4 → fix adapter fan-out/failover → expose counts from Postgres for catalogue → measure with seeded 100k records (Section J).

### 10. Wire analytics event capture (or stop claiming live analytics)
- **Competitor**: Koha stats/reports; DSpace COUNTER stats.
- **Current ESUT state**: `eventRecorder.recordEvent` has **0 callers**; `analytics_events` empty; dashboard + `/api/admin/analytics` deploy but show nothing.
- **Exact missing capability**: actual event stream (search, view, checkout, deposit).
- **Reason**: "unified analytics" is listed as a combined-platform advantage but is currently architecture-only.
- **Architecture impact**: small — client beacon on key actions + server hooks; backfill impossible (no data).
- **Dependencies**: none.
- **Recommended implementation**: instrument 5 events first (search, item view, login, checkout, deposit), verify rows land, then dashboard math.

### 11. Notice engine wiring + overdue email job
- **Competitor**: Koha notices (scheduled overdue/hold/claims, templates, slips).
- **Current ESUT state**: `src/server/circulation/notices.ts` + tests exist with **0 production callers**; email scattered inline; Resend blocked on domain verification; overdue worker failing (#19).
- **Exact missing capability**: scheduled patron-facing notices (overdue, hold-ready, registration).
- **Reason**: universities run on due-date reminders; currently nobody is emailed.
- **Architecture impact**: small-medium — scheduler job → notices module → single send path; templates table optional.
- **Dependencies**: §7 (workers), Resend domain verification (owner action).
- **Recommended implementation**: one job: overdue → generateNoticeContent → sendEmail; log outcome.

### 12. OAI-PMH correctness + external validation
- **Competitor**: DSpace (multi-format OAI, persistent deletions).
- **Current ESUT state**: deployed; `deletedRecord=no`; embargo/visibility filters not applied; Q1 `header` double-wrap bug in code; `ListRecords` returns 0 records (empty DB); never harvested by an external tool.
- **Exact missing capability**: conformance-clean oai_dc harvesting with sets from collections, embargo respected, resumption verified at scale.
- **Reason**: OAI is the primary standard IR interop; currently LEVEL 4 without proof.
- **Architecture impact**: small-medium — query fixes, `ListSets`, seed sample items for validation.
- **Dependencies**: none.
- **Recommended implementation**: fix filters/bug → seed 100 items (some embargoed) → harvest with `oai harvester`/Repository Explorer → record evidence.

### 13. Real AIP + scheduled fixity (+ withdraw/tombstone)
- **Competitor**: DSpace preservation pipeline.
- **Current ESUT state**: `preservation/aip.ts` writes `.txt` pseudo-bag without payload; `runFixityVerification()` has zero callers; no withdraw (row delete possible).
- **Exact missing capability**: zip AIP containing bitstreams+manifest, nightly fixity job, withdraw-with-tombstone.
- **Reason**: preservation claims must be operational, not simulated.
- **Architecture impact**: medium — depends on §8 file model for payload copy.
- **Dependencies**: §8, §7.
- **Recommended implementation**: after bundles exist: AIP zip job (idempotent, private bucket), fixity job weekly, `withdrawn_at` column + routes.

### 14. Type-error burn-down (64) + lint gate
- **Competitor**: both (upstream gates).
- **Current ESUT state**: `tsc --noEmit` = **64 errors**, all legacy app pages/components; ~63 from one `as const` pattern (`src/config/institution.config.ts:73` area); 1 cosmetic; 0 in new-wave dirs; lint config broken; `ignoreBuildErrors:true`.
- **Exact missing capability**: `tsc = 0`, lint runnable.
- **Reason**: only way to safely remove `ignoreBuildErrors` and get CI value (§5).
- **Architecture impact**: small code change + UI typing follow-through.
- **Dependencies**: none.
- **Recommended implementation**: fix pattern → run tsc → fix remainder → add CI step → delete ignore flag.

### 15. API documentation truth (59 undocumented routes) + OpenAPI
- **Competitor**: Koha REST (OpenAPI), DSpace REST docs.
- **Current ESUT state**: `docs/api.md` documents 23/82 route files; no OpenAPI; kbart documented but 500s.
- **Exact missing capability**: complete, tested API reference.
- **Reason**: integration surface is claimed as an advantage; undocumented + partly broken.
- **Architecture impact**: small (docs) / medium (generated OpenAPI).
- **Dependencies**: §1 (fix kbart first).
- **Recommended implementation**: inventory script → document per route (method, auth, sample) → optional openapi.yaml generated from route metadata.

### 16. Circulation rules as data + due-date calendar
- **Competitor**: Koha circulation rules matrix + calendars.
- **Current ESUT state**: loan rules hard-coded (`institution.config.ts`), exam-suspension boolean, no calendar-driven due dates; `calendar_events` table unused for checkout math.
- **Exact missing capability**: DB-configurable rules per category/itype/branch + working calendar skipping weekends/holidays in due-date computation.
- **Reason**: the library cannot self-configure policy without deploys; due dates are wrong across holidays.
- **Architecture impact**: medium — rules tables + checkout computation change + admin UI.
- **Dependencies**: none.
- **Recommended implementation**: `circulation_rules` rows + `dueDateFor(loan)` pure function with calendar lookup + tests.

### 17. Institution SSO (SAML/OIDC/LDAP)
- **Competitor**: both offer institutional auth options.
- **Current ESUT state**: Supabase email + Google only; Turnstile disabled.
- **Exact missing capability**: campus identity provider login.
- **Reason**: universities standardize on institutional accounts; manual registration won't scale to 10k patrons.
- **Architecture impact**: medium — Supabase auth provider config (mostly platform config, little code).
- **Dependencies**: IT department IdP (owner action).
- **Recommended implementation**: Supabase OIDC/SAML enterprise connection when IdP available; keep self-reg as fallback.

### 18. Real Z39.50 client + SRU CQL
- **Competitor**: Koha (Z39.50 client/server), both (SRU).
- **Current ESUT state**: Z39.50 = relabelled Open Library REST (honest label, protocol absent); SRU server has SRW envelope but no CQL (Postgres websearch fallback).
- **Exact missing capability**: configurable Z39.50 targets with MARC retrieval into staging; CQL index mapping on SRU.
- **Reason**: cataloguing by number/title against Library of Congress/NLC and union catalogs is standard practice.
- **Architecture impact**: medium — add yaz-based client or implement minimal CQL parser; both funnel into existing staging.
- **Dependencies**: network reachability to Z39.50 targets.
- **Recommended implementation**: SRU CQL first (no new deps: parse `title=foo AND author=bar`), then Z39.50 client.

### 19. Withdraw from search/advertising + suggestions feature decision
- **Competitor**: Koha suggestions; DSpace withdraw.
- **Current ESUT state**: `suggestions` table (0 code refs); no withdraw.
- **Exact missing capability**: patron purchase suggestions OR remove dead table; item withdrawal.
- **Reason**: dead tables mislead audits; withdraw is preservation hygiene.
- **Architecture impact**: small.
- **Dependencies**: product decision (build or drop).
- **Recommended implementation**: decide suggestion feature; add `withdrawn_at` either way (ties to §13).

### 20. Database hot-table index pass
- **Competitor**: both (mature schemas indexed over years).
- **Current ESUT state**: live DB: 125 tables all RLS-enabled, 0 policy-less (good), 327 indexes — but `circulation_transactions`, `reservations`, `fines`, `payments` have **1 index each**; **7 circulation FK columns lack covering indexes**.
- **Exact missing capability**: indexes on FK/join columns of high-write tables.
- **Reason**: p95 today is fine on empty data; at 50k loans these sequential scans dominate.
- **Architecture impact**: small — additive indexes, no code.
- **Dependencies**: EXPLAIN capture on real queries (Section J fixtures).
- **Recommended implementation**: index FK columns + `(checkout_date)`, `(due_date)`, `(status)` composites; recheck with seeded scale run.

---

## P2 — Valuable enhancements

### 21. MARCXML ingest + validation (cataloguing depth)
- **Competitor**: Koha. **State**: export-only `marc.ts`, 0 prod callers; client duplicates logic. **Gap**: XML→object parser, ISO2709 later, validation rules. **Impact**: medium (shared server lib becomes single source). **Deps**: §14 typing cleanup. **Impl**: parse MARCXML on import → staging; validation → error list UI.

### 22. Acquisitions depth: line receiving, encumbrance, claims
- **Competitor**: Koha. **State**: schema complete, UI flips status strings only. **Gap**: receive-by-line with qty/price, budget = ordered+received math, claim letters. **Impact**: medium (transaction logic + tests). **Deps**: §11 notices for claim emails. **Impl**: line-level receive endpoint with budget check; claims list job.

### 23. Withdraw/tombstone + per-object access policies
- **Competitor**: DSpace. **State**: 3 visibility states, hard delete. **Gap**: per-file/group policies, tombstone page. **Impact**: medium after §8. **Deps**: §8. **Impl**: `resource_policies` rows; tombstone route returns 410.

### 24. SWORD deposit endpoint + ResourceSync/Signposting wiring
- **Competitor**: DSpace. **State**: builders/service-doc only, labeled "Deployed" in progress doc (being corrected). **Gap**: actual SWORD POST, `/api/resourcesync`, Link headers. **Impact**: small-medium. **Deps**: §8 for multi-file deposits. **Impl**: expose three endpoints reusing existing builders + tests.

### 25. Serials pattern engine + claims dispatch
- **Competitor**: Koha. **State**: fixed-interval prediction works; claims CRUD static; KBART broken (§1). **Gap**: complex patterns, vendor claim emails, routing UI. **Impact**: small-medium. **Deps**: §11.

### 26. ILL lifecycle API + notifications
- **Competitor**: Koha ILL. **State**: broken submit (§3). **Gap**: statuses, patron updates, staff notes. **Impact**: small after §3. **Deps**: §3, §11.

### 27. COUNTER checkbox + SUSHI endpoint
- **Competitor**: DSpace. **State**: builder exists (unwired), SUSHI absent; progress doc claims overstate. **Gap**: usage page with COUNTER model + SUSHI harvester (needs KBART/platform creds). **Impact**: medium; institution's is mostly OA → value limited until subscribed DBs expose SUSHI. **Deps**: §11 events (§10).

### 28. Google Scholar/citation meta tags + canonical URLs
- **Competitor**: DSpace. **State**: sitemap/robots only. **Gap**: highwire/DC citation tags, OG/canonical per item. **Impact**: small (template change). **Deps**: items to tag (seed data). **Impl**: JSON-LD + highwire meta in item page + API `Accept: text/html`.

### 29. Batch metadata/bibliographic edit + merge
- **Competitor**: both. **State**: duplicates detection only (no merge). **Gap**: batch item edit; bib merge keep-one. **Impact**: medium. **Deps**: MARC ingest (§21) for overlay semantics.

### 30. Accessibility test pass (axe + keyboard smoke)
- **Competitor**: both (ongoing). **State**: ~83 aria attrs, no automated tests. **Gap**: axe in CI, fix violations. **Impact**: small. **Deps**: CI (§5).

### 31. Multilingual wiring (or explicit deferral)
- **Competitor**: Koha 40+ languages, DSpace mature i18n. **State**: `i18n.ts` (en/fr) has 0 page callers. **Gap**: switcher + `t()` adoption, or officially defer (single-language institution). **Impact**: small if deferred; large if wired. **Deps**: product decision. **Impl**: document decision; if wired, layout-level language menu first.

---

## P3 — Optional / niche

- **32. Multi-currency** — Koha has rates; ESUT hardcodes NGN. Not needed unless foreign acquisitions.
- **33. POS (till/cash-up)** — Koha full POS; ESUT only fine receipts. Build only if the library sells services.
- **34. ERM agreements/coverage** — Koha ERM deeper; ESUT now has subscribed-databases directory (static). Build if e-resource management becomes a real workflow.
- **35. IIIF, METS export, LOCKSS** — DSpace ecosystem territory; low institutional value now.
- **36. Patron clubs / bookings / inventory / stock rotation** — Koha extras; no institutional requirement known.
- **37. Plugin architecture** — never worth building; keep modular server code instead.

---

## Explicit non-priorities (do not chase for parity's sake)

- Matching Koha's translation ecosystem, plugin marketplace, or 20-year deployment history.
- DSpace-scope features ESUT intentionally doesn't need (IIIF viewers per se, LOCKSS).
- UI modernity as a competitive claim — UI looks newer than both; that is not functional advantage.
