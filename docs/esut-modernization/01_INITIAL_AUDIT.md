# 01 — Initial System Audit (ESUT Virtual Library)

**Platform:** https://virtuallibrary.esut.edu.ng
**Audit date:** 2026-10-11 (pre-implementation baseline) — updated with 2026-10-20 re-audit references
**Scope:** ESUT only. AFUED (`afuedlibrary.org.ng`) was explicitly out of scope for this engagement.
**Method:** Read-only source, schema, migration, route and RLS inspection. No production data was modified during the audit. Findings below cite the actual files inspected; nothing is inferred from folder names or previous claims.

---

## 1.1 Architecture discovery

| Layer | Technology | Evidence |
| --- | --- | --- |
| Web framework | Next.js 16.4.0 (App Router) with a client-side react-router SPA mounted from the catch-all route | `package.json`, `app/[...slug]/page.tsx`, `src/App.tsx` |
| UI runtime | React 18.3.1 (client), `@fontsource` self-hosted fonts | `package.json`, `app/layout.tsx` |
| Database / auth / storage | Supabase (Postgres + RLS + Auth + Storage). Browser client uses the anon key, so **RLS is the real enforcement layer** | `src/lib/supabase.ts`, `supabase/migrations/*` |
| Background processing | Node worker polling `agent_jobs` via `claim_agent_jobs`, scheduled through `agent_schedules` | `worker/runner.ts`, `worker/scheduler.ts`, `worker/handlers/index.ts` |
| Public API | Route handlers under `app/api/**` with role guards (`requireRole`, `requireUser`) and rate limiting in `middleware.ts` | `app/api/**`, `middleware.ts` |
| Interoperability | OAI-PMH endpoint `app/api/oai` (application code); a duplicate, unconfigured `supabase/functions/oai-pmh/` edge function exists | `app/api/oai/route.ts`, `supabase/functions/oai-pmh/` |
| Deployment | Docker image → GitHub Container Registry → Coolify-managed container on a VPS; old `esut-app-new` container retained stopped as rollback | Runbook `ESUT_Smart_Library_Complete_Platform_Runbook.docx`, commit `44854c1` |

Key architectural characteristic: most pages are rendered client-side (SPA). Server-rendered HTML metadata therefore has to be produced explicitly in the Next.js route layer; nothing was produced before this pass (see T02).

## 1.2 Existing feature classification (baseline statuses)

Statuses use **WORKING / PARTIAL / BROKEN / MISSING** for the official spec items T01–T12 (spec text: October 2026 "Technical Improvement Specification", extracted verbatim to the audit record).

| ID | Baseline status | Evidence-based finding |
| --- | --- | --- |
| T01 Institutional repository | **PARTIAL** | Public item pages and workflow exist (`src/app-pages/RepositoryItem.tsx`, `supabase/migrations/20260620202651*`), but: no citation export (BibTeX/RIS) anywhere; no related-publications feature; canonical URLs were built from slash-containing handles (`esutir/<year>/<hex>`) which cannot resolve through the client route `/repository/:id`; `item_versions` readable by anon (data leak of version history); duplicate `ir_items` model alongside `repository_items` kept legacy drift. |
| T02 Scholarly metadata / SEO | **BROKEN** | The entire public site served no HTML `<head>` metadata: the catch-all page was a client shell with no `generateMetadata`, no Highwire `citation_*` tags, no JSON-LD, no `metadataBase`; `public/robots.txt` and `public/sitemap.xml` were static files with placeholder content; the catalog/repository sitemap routes hard-coded a domain. A crawler sees an empty head on every record page. |
| T03 Submission & moderation | **PARTIAL — critical RLS gaps** | Workflow code exists (`src/server/workflow/*`), but RLS allowed: (a) a submitter to self-publish by updating `status` because `repo_items_update_own` / `theses_own` `WITH CHECK` did not exclude privileged states; (b) audit-trail forgery — `ts_insert`/`ts_update`/`ts_delete`/`tw_insert` policies had `WITH CHECK (true)` allowing authenticated users to insert fabricated workflow rows; (c) no staff UPDATE policy at all, so admin publish buttons matched 0 rows (silent failure); (d) the backend role model lacked `supervisor`. |
| T04 Researcher identity / ORCID | **PARTIAL** | `/researchers/:slug` returned wrong status/columns and referenced a non-existent table; no author de-duplication; ORCID fields exist on records but verification status handling is incomplete. |
| T05 Indexing diagnostics | **MISSING** | No sitemap-coverage computation, no indexability reporting, no broken-link checks, no duplicate-record alerts, no scheduled diagnostics, no admin surface of any kind. |
| T06 Theses & dissertations | **BROKEN/PARTIAL** | `ThesisListing.tsx` queried non-existent columns (`authors`, `degree_level`, `graduation_year`) with `status='approved'` → the public listing always rendered empty; no anonymous RLS read policy on `theses`; no per-thesis public landing page (`/theses/:id` did not exist; "View Full Record" pointed at the marketing portal page); embargo flags never blocked anything; no clearance field. |
| T07 OAI-PMH & exports | **PARTIAL** | Endpoint exists and returns DC records, but 4 protocol defects: `earliestDatestamp` emitted without required granularity; `resumptionToken` expiration missing the `UTCdatetime` part; `badVerb` response still carried a `verb` attribute; argument validation accepted stray parameters. BibTeX/RIS export missing entirely. A duplicate broken edge function existed. `/api/repository` was not rate-limited. |
| T08 Research visibility analytics | **PARTIAL** | Downloads/views events exist (`analytics_events`), but no indexed-page coverage, no referrer-class reporting, no deposit-volume trend, no quality flags, no research-visibility dashboard. |
| T09 Journal / OER / integration | **PARTIAL** | Journal, OER and directory databases exist as catalog entities, but there is no linkage between journal articles / OER and repository records, no cross-linking, and no link-health reporting. |
| T10 Digital preservation | **PARTIAL** | Fixity production/verification worker handlers exist (`worker/handlers/preservation/*`), but: backup encryption status unverified, no documented scheduled backup monitoring job output, no recorded restore drill (restore UI exists but no evidence of an executed test), storage-provider inactive reasons visible. |
| T11 AI research discovery | **PARTIAL** | AILibrarian chat exists, but: answers are not grounded in approved repository records with source links; no semantic/embedding search; no recommendations; a dead `aiSummary` field is carried on records; no AI token spend cap. |
| T12 Accessibility / performance | **PARTIAL** | Skip link, focus states and ARIA patterns exist in components, but duplicate Google Fonts links were emitted in `app/layout.tsx`, no cache headers were set on sitemap/metadata routes, no Core Web Vitals measurement exists, and no recorded Lighthouse baseline. |

## 1.3 Protect existing functionality (audit guard-rails established)

- No `any` types, no new `eslint-disable`, no new source comments in changed files.
- Security posture may only tighten; no policy is ever weakened to make a test pass.
- Secrets are only read from environment/secret stores and are never printed (status/length only).
- Public metadata and private patron records must remain strictly separated (spec §5).
- Production RLS/schema migrations are **written with rollback but not auto-applied** — they are flagged for owner approval.
- Scope stays ESUT; no AFUED files are touched.

## 1.4 Measurable baseline

| Baseline metric | Pre-implementation value | Measurement source |
| --- | --- | --- |
| Server HTML metadata on record pages | 0 tags emitted (no `generateMetadata`) | `app/[...slug]/page.tsx` (pre-change) |
| `robots.txt` / sitemap index | Static placeholder files | `public/robots.txt`, `public/sitemap.xml` (deleted this pass) |
| OAI conformance defects | 4 (granularity, expiration, badVerb attribute, strict validation) | `src/server/oai/service.ts` pre-change inspection |
| Public thesis records reachable | 0 (query selected non-existent columns) | `src/app-pages/ThesisListing.tsx` pre-change |
| RLS escalation defects | 4 classes (self-publish, audit forgery, no staff update, missing supervisor role) | `supabase/migrations/20260620202651*` policy inspection |
| Automated tests | 766 tests (vitest suite, pre-change) | `vitest run` output recorded in `12_AUTOMATED_TEST_RESULTS.md` |
| Critical security findings open at release | 1 class — RLS escalation (fix written, **pending owner approval to apply**) | `supabase/migrations/20261011130000_rls_escalation_fixes.sql` |

*All numbers above are taken from actual file inspection and executed test runs in this engagement; nothing is estimated.*
