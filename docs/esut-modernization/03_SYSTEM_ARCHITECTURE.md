# 03 — System Architecture (ESUT Virtual Library, post-modernization)

This document describes the architecture **as implemented after the 2026-10 modernization pass**, with emphasis on the scholarly-record, indexing and security paths that this engagement introduced or hardened.

## 1. Request flow

```
Browser ── HTTPS ──► Cloudflare ──► Coolify container (Next.js 16, node:20-alpine)
                                        │
             middleware.ts ─────────────┼── auth session refresh
                                        ├── rate limiting (sensitive prefixes incl. /api/repository, /api/ai/*)
                                        └── x-robots-tag: noindex, follow  (admin/dashboard/private + faceted URLs)
                                        │
        ┌───────────────────────────────┴───────────────────────────────┐
        │  Static metadata routes (server)                              │  SPA (client react-router)
        │  /robots.txt            app/robots.ts                         │  app/[...slug]/page.tsx
        │  /sitemap.xml           sitemap index                         │    └─► src/App.tsx (all UI routes)
        │  /sitemap-static.xml                                      │
        │  /repository-sitemap.xml  published+global, embargo-filtered │
        │  /catalog-sitemap.xml     global catalogue items             │
        │  /theses-sitemap.xml      published theses                   │
        │  /api/oai                 OAI-PMH 2.0 endpoint               │
        └───────────────────────────────────────────────────────────────┘
```

The public site is a client SPA, so **all crawl-visible HTML metadata is produced in the Next route layer**, not in React components.

## 2. Scholarly record → search engine pipeline (T01/T02/T05/T06/T07)

| Step | Component | Notes |
| --- | --- | --- |
| Public gate | `src/server/repository/publicItem.ts` (`getPublicRepositoryItem`) | Requires `status='published' AND visibility='global'` and non-embargoed; strips `status`, `visibility`, `embargo_until` from the public payload. Resolves immutable UUID **or** legacy multi-segment handle. Request-memoized via `src/server/util/requestMemo.ts` (React `cache` when available, identity fallback otherwise). |
| Scholarly item | `src/server/seo/scholarlyMetadata.ts` | Pure mapping + builders: Highwire `citation_*` meta tags (arrays for repeated `citation_author`), OpenGraph/Twitter, canonical URL, `robots`, and Schema.org JSON-LD (`ScholarlyArticle`/`Thesis`/`CreativeWork` by `item_type`). `isAccessibleForFree` is `false` unless a public PDF exists; `<` is escaped in JSON-LD. |
| Landing page metadata | `app/[...slug]/page.tsx` | `generateMetadata` for `/repository/<ref>` and `/theses/<id>`; JSON-LD `<script>` injected server-side; unresolved refs get `robots: noindex, follow`. |
| Sitemaps | `app/*-sitemap.xml/route.ts` | Repository sitemap lists canonical UUID URLs (handle URLs were removed because they cannot match the client route); visibility/embargo filters mirror the public gate; theses sitemap lists published thesis records; every sitemap carries `cache-control`. |
| OAI-PMH | `app/api/oai/route.ts` + `src/server/oai/service.ts` | `oai_dc` records with UTCdatetime granular dates, strict argument validation, `resumptionToken` isolation. OAI `dc:identifier` may carry legacy handle URLs, which resolve server-side and consolidate to the canonical URL via rel=canonical. |
| Citation export | `src/server/repository/citationExport.ts` + `/api/repository/[id]/citation` + `/api/theses/[id]/citation` | Pure BibTeX/RIS builders shared by repository items and thesis records; attachment headers; public-records-only. |
| Diagnostics | `src/server/visibility/visibilityDiagnostics.ts` | Computes indexable counts, sitemap coverage, metadata gaps, duplicate titles, crawlability probes (deep mode) and DOI link checks (deep mode, capped at 25). Exposed via `/api/admin/visibility` and computed daily by the worker job `visibility.diagnostics`. |

## 3. Thesis (ETD) public surface (T06)

- **Server:** `src/server/thesis/publicThesis.ts` — `listPublicTheses` (search/sort/pagination) and `getPublicThesis` (single record) run with the service-role client and enforce `status='published'` in application code. The student's name is joined read-only from `patrons.full_name` via PostgREST embed (`patron:patrons!theses_patron_id_fkey(full_name)`); patrons are **never** exposed to anon clients.
- **API:** `GET /api/theses`, `GET /api/theses/[id]`, `GET /api/theses/[id]/citation`.
- **UI:** `src/app-pages/ThesisListing.tsx` (fixed columns, real fields, API-backed) and `src/app-pages/ThesisDetail.tsx` (stable landing page at `/theses/<uuid>` with citation panel, embargo state, restricted-file messaging, repository cross-link).
- **Embargo:** computed in code as `approval_date (or created_at) + embargo_period_months`; the file link is withheld while active, metadata stays public.
- **Citation policy:** the student is the author; the supervisor is metadata only and is never emitted as an author (asserted by test).

## 4. Security model

- RLS is the enforcement layer: the browser client holds only the anon key. Server routes use `requireUser`/`requireRole` with role constants from `src/server/auth/permissions.ts` (new `VISIBILITY_ADMIN_ROLES` for indexing diagnostics).
- `src/server/supabase/adminClient.ts` (service role) is used only behind server-side gates; public data leaves the server only after the public gate is applied in code.
- **Pending production change:** `supabase/migrations/20261011130000_rls_escalation_fixes.sql` (with rollback in `supabase/migrations/rollback/`) tightens WITH CHECK clauses on repository/thesis writes, restricts `thesis_workflow` inserts to the acting user, scopes anon version-history reads to published/global items, and adds staff moderation UPDATE policies checked via `public.has_any_role` (browser JWTs carry `role=authenticated`, never an application role). **Not applied — requires owner approval** (see `10_SECURITY_PRIVACY_AUDIT.md`).

## 5. Background processing

- Worker (`worker/index.ts`) polls `agent_jobs` through `claim_agent_jobs`, executes registered handlers (`worker/handlers/index.ts`), and schedules rows from `agent_schedules`.
- New handler: `visibility.diagnostics` (`worker/handlers/visibility.ts`) — daily DB-only diagnostics run; seeded by `supabase/migrations/20261011140000_visibility_diagnostics_schedule.sql`.
- Worker handlers may import `@/server/**` modules (established pattern: `notices.ts`, `scheduledReports.ts`).

## 6. Internationalisation & accessibility conventions

- Two locales (`en`, `fr`) through `src/lib/i18n`; all new user-visible strings were added to both dictionaries (`thesisDetail.*`, `visibility.*`, `admin.visibilityIndexing`).
- Client pages keep `usePageTitle`, semantic headings, `aria-pressed` on toggle groups, `role="progressbar"` with values, and the existing button/card classes for visual consistency.
