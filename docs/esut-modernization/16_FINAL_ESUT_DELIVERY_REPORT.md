# ESUT Virtual Library — Final Delivery Report (Phase 21)

Platform: `https://virtuallibrary.esut.edu.ng` (ESUT only — AFUED out of scope).
Base commit: `44854c1`. Gates after final hardening: **tsc 0 · eslint 0 warnings · 95 files/797 tests PASS · next build PASS**.

## Per-requirement report (T01–T12)

### T01 — Institutional repository (P0)
- **Original:** PARTIAL — records/workflow existed; no public landing pages, no stable scholarly URLs, no citation export.
- **Changes:** public `/repository/<uuid>` landing pages (Highwire + JSON-LD + canonical), BibTeX/RIS citation routes gated on the public item gate.
- **Files:** `app/[...slug]/page.tsx`, `src/server/repository/publicItem.ts`, `src/server/seo/scholarlyMetadata.ts`, `src/server/repository/citationExport.ts`, `app/api/repository/[id]/citation/route.ts`.
- **DB:** none required (UUIDs already immutable). **Backend:** service-role gated reads. **Frontend:** existing item page consumes new citation links.
- **Tests:** citationExport (5), public metadata assertions; audit-verified gates. **Standards:** Highwire/Schema.org, canonical URLs.
- **Limitations:** DOI minting is Zenodo-fallback, not an authorized registration agency. **Final: COMPLETE** (pending production content supply).

### T02 — Scholarly metadata & SEO (P0)
- **Original:** PARTIAL — static robots/sitemap only; no citation tags/JSON-LD.
- **Changes:** metadata pipeline, robots.ts, sitemap index + 4 child sitemaps (UUID repository URLs), noindex/rate-limit middleware, metadataBase, font CDN removal.
- **Files:** `scholarlyMetadata.ts`, `app/robots.ts`, `app/sitemap*.xml/route.ts` ×5, `middleware.ts`, `app/layout.tsx`.
- **DB:** none. **Backend:** server-rendered metadata. **Frontend:** n/a (head-level).
- **Tests:** metadata assertions in both scholarly suites; audit verified robots `?` semantics and noindex scoping. **Standards:** Google Search Central guidance; Scholar inclusion *readiness* only.
- **Limitations:** GSC unverified (institutional); `citation_pdf_url` absent until public PDFs exist. **Final: COMPLETE** (technical readiness).

### T03 — Submission & moderation (P0)
- **Original:** PARTIAL-critical — RLS escalation (self-publish), audit forgery, no working staff UPDATE path.
- **Changes:** `20261011130000_rls_escalation_fixes.sql` + verbatim rollback: status-restricted WITH CHECKs, `has_any_role` moderation policies, `tw_insert` actor rule, scoped anon versions read; browser screens set `acted_by` and verify update row counts.
- **Files:** migration + rollback, `admin/Repository.tsx`, `admin/Theses.tsx`, `supervisor/Theses.tsx`, `RepositorySubmit.tsx`.
- **DB:** the migration above — **NOT APPLIED (owner approval required)**. **Backend:** workflow APIs unchanged. **Frontend:** moderation UIs hardened.
- **Tests:** lint/typecheck on accompanying code; SQL logic re-verified line-by-line vs predecessor policies by two blind audits. **Standards:** RBAC least-privilege.
- **Limitations:** supervisor direct browser UPDATE stays blocked (workflow API path works). **Final: COMPLETE (code) / BLOCKED (application) — top owner action.**

### T04 — Identity & affiliation (P0)
- **Original:** PARTIAL. **Changes:** none this pass (ORCID data already captured on deposits; carried into metadata). **Limitations:** profile-level ORCID, verification, dedup remain backlog. **Final: PARTIAL.**

### T05 — Search indexing diagnostics (P0)
- **Original:** MISSING. **Changes:** diagnostics engine + admin API + worker job + schedule migration + admin UI (deep mode capped/SSRF-safe; honest `not_configured` GSC state).
- **Files:** `src/server/visibility/visibilityDiagnostics.ts`(+test), `app/api/admin/visibility/route.ts`, `worker/handlers/visibility.ts`, `20261011140000_visibility_diagnostics_schedule.sql`, `admin/Visibility.tsx`, i18n.
- **DB:** schedule row migration (safe/idempotent). **Backend:** worker registration. **Frontend:** nav + page (role-gated).
- **Tests:** 5 unit tests; audit verified authz + caps. **Limitations:** GSC verification (institutional). **Final: COMPLETE** (minus GSC connection).

### T06 — Theses & dissertations (P1)
- **Original:** PARTIAL-broken — public listing queried non-existent columns (always empty); no public theses pages; embargo invisible.
- **Changes:** public thesis server module (published-only gate, embargo math, patron-name embed, PII-stripped co-supervisors), `/api/theses` list/detail/citation, rewritten `/theses` listing, new `/theses/<id>` page, i18n en/fr, embargo-enforced downloads.
- **Files:** `publicThesis.ts`(+test), 3 API routes, `ThesisListing.tsx`, `ThesisDetail.tsx`, `secureThesisDownload.ts`, `App.tsx`, dictionaries.
- **DB:** none (embed via existing FK). **Backend:** service-role gated reads. **Frontend:** two pages + route.
- **Tests:** publicThesis 13; audit defect ledger cleared. **Standards:** ETD public-metadata practice; embargo = metadata-public/file-withheld.
- **Limitations:** `visibility` column non-operational; degree filter pattern-based. **Final: COMPLETE.**

### T07 — OAI-PMH & exports (P1)
- **Original:** PARTIAL — endpoint existed but non-conformant; no citation export.
- **Changes:** granularity fixes, strict badArgument (incl. unknown params, GetRecord/List* argument rules), UTF-8-safe HMAC tokens, control-char-safe XML, rate limiting, BibTeX/RIS routes with injection neutralization.
- **Files:** `src/server/oai/service.ts`(+test), `oaiXml.ts`, `app/api/oai/route.ts`, citation routes/exporter, `middleware.ts`.
- **DB:** none. **Backend:** admin-client reads. **Frontend:** export buttons on item/thesis pages.
- **Tests:** OAI 35 + citation 5. **Standards:** OAI-PMH 2.0, oai_dc/datacite/marcxml.
- **Limitations:** endpoint off until `OAI_ENABLED=true`; legacy edge-function duplicate deprecated; external validator run pending. **Final: COMPLETE** (enablement pending env action).

### T08 — Visibility analytics (P1): **PARTIAL** — sitemap/robots coverage diagnostics added; referrer-class, deposit-trend, quality-flag dashboards not built (prioritized backlog).

### T09 — Journal & OER integration (P1): **PARTIAL** — no cross-linking built; journal fields exist on `researcher_publications`; backlog.

### T10 — Digital preservation (P1): **PARTIAL** — fixity/versioning verified working (versions API now authz-gated); backup-encryption evidence and documented restore drill outstanding (institutional).

### T11 — AI research discovery (P2): **PARTIAL** — existing librarian links sources; semantic search and token spend cap not implemented (backlog).

### T12 — Accessibility & performance (P2): **PARTIAL** — fonts/caching/noindex/a11y-fixes done; CWV instrumentation absent (needs RUM/CrUX — institutional/ops).

## Totals

- **Requirements fully completed: 5** (T01, T02, T05, T06, T07) + T03 code-complete but application-blocked.
- **Partially completed: 6** (T03-application, T04, T08, T09, T10, T11, T12 counted as T03-blocked + 6 partials).
- **Blocked: 0 permanently** — T03 application awaits owner approval.
- **Known defects (open):** none rated HIGH/MEDIUM in code; pre-existing follow-ups listed in `10_SECURITY_PRIVACY_AUDIT.md` (authenticated `versions_read` scope, counters, `degree_programme` drift, middleware→proxy rename).
- **Security findings:** all HIGH findings from the blind audits fixed in code; production remains exposed until the RLS migration is applied.
- **Deployment readiness:** app build green and deployed container healthy; **production security posture is not signed off until the RLS migration lands**.
- **Institutional actions:** see `14_INSTITUTIONAL_DEPENDENCIES.md` (RLS approval, GSC, env vars, PAT rotation, Resend DNS, Turnstile, policy/PDF supply, restore drill).
- **Next technical priorities:** 1) apply RLS migration; 2) GSC + submit sitemaps; 3) enable OAI + external validation; 4) CWV baseline; 5) T08 analytics dashboard; 6) supervisor-scoped thesis policy if product requires.

## External-requirement explanation

Google Scholar/Search Console involve Google-side verification and recrawl — only technical readiness was implemented; **no claim is made that Scholar has indexed anything**. Webometrics outcomes depend on institutional policy, content volume and recognition — **no ranking improvement is guaranteed**. Production migration application, DNS/email verification, MFA and backup encryption are owned by ESUT Library/ICT under `14_INSTITUTIONAL_DEPENDENCIES.md`.
