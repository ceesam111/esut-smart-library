# ESUT Virtual Library — Requirements Traceability (T01–T12)

Mapping from spec minimum deliverables to implemented artifacts. "Verified by" cites automated tests or the Phase 18 blind audits.

| Spec requirement (minimum deliverable) | Implemented artifact | Verified by |
|---|---|---|
| **T01** Public research records with stable URLs | `app/[...slug]/page.tsx` (catch-all, `force-dynamic`); `src/server/repository/publicItem.ts`; canonical `/repository/<uuid>` | Audit T01–T06 §A (public gate, payload strip, canonical consistency); `publicItem` gate covered indirectly via citation-route tests |
| **T01** Citation export | `src/server/repository/citationExport.ts`; `app/api/repository/[id]/citation/route.ts`; `app/api/theses/[id]/citation/route.ts` | `citationExport.test.ts` (5 tests incl. newline-injection); both routes enforce the public gate (audit-verified) |
| **T02** Citation meta tags + Schema.org + canonicals | `src/server/seo/scholarlyMetadata.ts` (Highwire arrays, JSON-LD `ScholarlyArticle`/`Thesis`, `<` escaped to `<`) | `publicThesis.test.ts` (metadata assertions), `scholarlyMetadata` covered via both suites; audit-verified `citation_pdf_url` rules |
| **T02** XML sitemap index + per-collection sitemaps | `app/sitemap.xml` (index), `app/sitemap-static.xml`, `app/repository-sitemap.xml` (UUID URLs), `app/catalog-sitemap.xml`, `app/theses-sitemap.xml`; `app/robots.ts` | Audit T01–T06 §A (robots `?` semantics, noindex scope); schema columns existence checked in base migrations |
| **T02** Crawl hygiene | `middleware.ts` (`x-robots-tag: noindex` for admin/dashboard/supervisor/reset-password/thesis-submit/thesis-status + faceted query URLs; rate limits incl. `/api/oai`) | Audit-verified exact-match noindex (detail pages never noindexed) |
| **T03** Moderation without escalation | `supabase/migrations/20261011130000_rls_escalation_fixes.sql` + `rollback/…down.sql` | Blind audits (both) found and drove fixes of the JWT-gate and rollback defects; final form re-verified by tsc/lint on accompanying code; **SQL itself not executable offline — applied only after owner approval** |
| **T03** Audit trail integrity | `tw_insert` policy `WITH CHECK (acted_by = auth.uid())`; browser writers set `acted_by` (`admin/Theses.tsx`, `supervisor/Theses.tsx`) | Audit defect ledger; code verified |
| **T05** Index/broken-link diagnostics | `src/server/visibility/visibilityDiagnostics.ts` (+`.test.ts`, 5 tests); `app/api/admin/visibility/route.ts`; `worker/handlers/visibility.ts`; `supabase/migrations/20261011140000_visibility_diagnostics_schedule.sql`; `src/app-pages/admin/Visibility.tsx` | Unit tests (bounded probes, SSRF-safe host, gap labels); audits verified authz (403 path), caps, and `.or()` filter safety |
| **T06** Public ETD records | `src/server/thesis/publicThesis.ts` (+`.test.ts`); `app/api/theses/route.ts`; `app/api/theses/[id]/route.ts` | `publicThesis.test.ts` (11 tests: embargo math, published-only gate, scholarly mapping, co-supervisor PII strip, degree patterns) |
| **T06** Thesis landing pages + UI | `src/app-pages/ThesisListing.tsx` (rewritten, real columns); `src/app-pages/ThesisDetail.tsx`; `App.tsx` `/theses/:id`; i18n `thesisDetail.*`/`thesisListing.*` (en+fr) | Audit-verified column correctness vs base migration; i18n parity audit (identical key structures) |
| **T06** Authorized full text | `src/server/thesis/secureThesisDownload.ts` (owner/patron/supervisor/staff, published **and not embargoed** public branch); embargo computed in `publicThesis.ts` | Post-audit fix (embargo now enforced server-side); pure embargo functions unit-tested |
| **T07** OAI-PMH endpoint | `app/api/oai/route.ts`; `src/server/oai/service.ts`; `src/server/oai/oaiXml.ts`; crosswalks `oai_dc`/`datacite`/`marcxml` | `service.test.ts` (35 tests: six verbs, resumption, strict badArgument incl. new GetRecord/List* checks, UTF-8 token round-trip, XML conformance) |
| **T05/GSC** Search Console | Diagnostics show `not_configured` honestly | Visibility page state; institutional action list |
| **T08–T12** | Partial — see gap matrix and per-area deliverables (`08`–`11`) | Honest PARTIAL status, not claimed complete |

Not covered by automated tests (documented as such): live PostgREST embed behavior, hosted-DB drift, real Googlebot rendering, OAI end-to-end against a live harvester, production RLS application.
