# ESUT Virtual Library — Implementation Change Log

Base commit `44854c1` → working tree (uncommitted at time of writing; commit follows sign-off). All changes ESUT-only.

## New server modules

| File | Purpose |
|---|---|
| `src/server/seo/scholarlyMetadata.ts` | Highwire citation_* meta tags, JSON-LD (ScholarlyArticle/Thesis), canonical URL builder, `isPubliclyIndexable`, `toJsonLdHtml` (`<` escaped) |
| `src/server/repository/publicItem.ts` | Public repository gate: `status=published AND visibility=global AND not embargoed`; strips status/visibility/embargo from payloads |
| `src/server/repository/citationExport.ts` | `toBibtex`/`toRis` with brace/backslash and CR/LF neutralization (citation-injection defense) |
| `src/server/thesis/publicThesis.ts` (+tests) | Public thesis gate (`status='published'`), embargo computation, patron `full_name` embed (service role), name-only co-supervisors (PII strip), comma/quote-safe search, pattern-based degree filter |
| `src/server/visibility/visibilityDiagnostics.ts` (+tests) | T05 diagnostics: published/indexable/embargoed counts, sitemap coverage, duplicate titles, metadata gaps, robots/sitemap reachability, optional deep mode (25 DOI HEAD cap, 5 s timeout, fixed-host fetch) |
| `src/server/util/requestMemo.ts` | React `cache` wrapper with identity fallback; verified no cross-request staleness |

## New/changed API routes

- `app/api/theses/route.ts`, `app/api/theses/[id]/route.ts`, `app/api/theses/[id]/citation/route.ts` — public thesis list/detail/citation; generic error messages (no DB echo), safe `decodeURIComponent`, cache headers.
- `app/api/repository/[id]/citation/route.ts` — public-gated BibTeX/RIS; safe decode.
- `app/api/repository/versions/route.ts` — **GET now authz-gated** (public items readable by any signed-in user; private items owner/staff only); POST restricted to owner/staff (was unauthenticated-item write path).
- `app/api/admin/visibility/route.ts` — admin-only diagnostics; 401/403/500 mapping corrected.
- `app/api/oai/route.ts` — `__metrics` moved behind `OAI_ENABLED`; unknown query params → `badArgument`; rate-limit/`badArgument` bodies use OAI UTCdatetime granularity; `/api/oai` rate-limited in middleware (Arcjet bot-filter excluded so harvesters aren't blocked).

## Pages & UI

- `app/[...slug]/page.tsx` — catch-all `generateMetadata` + JSON-LD for `/repository/<ref>` and `/theses/<id>`; malformed `%` decode no longer 500s.
- `app/robots.ts`, sitemap index + `sitemap-static`/`repository`(UUID URLs)/`catalog`/`theses` children; `app/layout.tsx` metadataBase + duplicate Google-Font CDN links removed (self-hosted @fontsource only).
- `middleware.ts` — noindex for `/thesis/submit`, `/thesis/status`; faceted noindex unchanged (detail pages excluded); `/api/oai` rate limit.
- `src/app-pages/ThesisListing.tsx` — rewritten on real columns; API-backed; `Fragment` key fix; visible error state (`thesisListing.loadFailed`, en+fr).
- `src/app-pages/ThesisDetail.tsx` (new) — `/theses/<id>` record page; embargo-aware access panel (no-file check first); clipboard failure path handled.
- `src/app-pages/Thesis.tsx` — legacy portal now reads `/api/theses` (was anon `theses` query that always returned empty).
- `src/app-pages/admin/Visibility.tsx` (new) + AdminLayout nav — diagnostics UI; `role="alert"` on messages.
- `src/app-pages/admin/Repository.tsx` — status updates now verify affected rows (`.select('id')`); no optimistic success / rejection email on failed updates.
- `src/app-pages/admin/Theses.tsx`, `src/app-pages/supervisor/Theses.tsx` — `thesis_workflow` inserts carry `acted_by` (current user).
- `src/app-pages/RepositorySubmit.tsx` — initial-version POST now sends the bearer token.
- i18n: `thesisDetail.*`, `thesisListing.*`, `visibility.*`, `admin.visibilityIndexing` added to **both** `en.ts` and `fr.ts` (identical structures).

## Security (T03) — written, NOT applied

- `supabase/migrations/20261011130000_rls_escalation_fixes.sql`:
  - `repo_items_update_own` — submitter can edit only while `status='submitted'`, cannot change status.
  - `repo_items_insert` — submitter inserts `submitted` only; moderators any status.
  - `repo_items_update_admin` / `theses_update_admin` — moderation via `public.has_any_role` (JWT `role` claim is `authenticated` for browsers).
  - `theses_own`/`theses_update_submitter` replaced by scoped insert/update/delete with `status NOT IN ('published','approved')`.
  - `tw_insert` — `WITH CHECK (acted_by = auth.uid())`.
  - `versions_read_anon` — scoped to published/global parent items.
- `supabase/migrations/rollback/20261011130000_rls_escalation_fixes.down.sql` — restores predecessors **verbatim** (as last set by `20260620202651`, `20260620202944`, `20260621002011`).
- `supabase/migrations/20261011140000_visibility_diagnostics_schedule.sql` — worker schedule row.

## OAI-PMH conformance fixes (app code)

- `earliestDatestamp` + resumptionToken `expiration` in UTCdatetime granularity; missing-verb response omits `verb` attribute; strict `badArgument` for stray args, token-not-alone, `GetRecord`+from/until/set, `ListIdentifiers`/`ListRecords`+identifier, unknown params; XML escaping strips control chars; resumption tokens base64 via UTF-8 encoding.
- Duplicate `supabase/functions/oai-pmh/` edge function: **deprecated documentation item**, not deployed.

## Hygiene

- No `any`, no new `eslint-disable`, no new code comments in changed source files (SQL headers excepted); `.gitignore` += `*.tsbuildinfo`.
