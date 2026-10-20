# ESUT Virtual Library — Implementation Plan (as executed)

Scope: ESUT only (`virtuallibrary.esut.edu.ng`). AFUED explicitly out of scope.

## Sequencing actually followed

1. **Discovery & audit** — production reviewed against spec T01–T12; findings in `01_INITIAL_AUDIT.md`.
2. **Architecture decisions** — documented in `03_SYSTEM_ARCHITECTURE.md` (canonical UUID URLs, published-only public gates, service-role server reads, request-scoped memoization).
3. **Build phases** (this pass):
   - **P1 — Scholarly surface (T02/T01):** `scholarlyMetadata.ts`, `publicItem.ts`, catch-all `generateMetadata` + JSON-LD, `robots.ts`, sitemap index + 4 child sitemaps, middleware noindex/rate-limit, `layout.tsx` metadataBase + font consolidation.
   - **P2 — Interoperability (T07):** OAI-PMH conformance fixes, strict argument validation, UTF-8 tokens; `citationExport.ts` (BibTeX/RIS) + citation routes for repository and theses.
   - **P3 — Theses (T06):** `publicThesis.ts` server module, `/api/theses` list/detail/citation, `ThesisListing.tsx` rewrite, `ThesisDetail.tsx` landing page, `/theses/:id` route, en/fr i18n.
   - **P4 — Diagnostics (T05):** `visibilityDiagnostics.ts` (+tests), `/api/admin/visibility`, worker handler `visibility.diagnostics`, schedule migration `20261011140000`, admin page `/admin/visibility`.
   - **P5 — Security hardening (T03):** `20261011130000_rls_escalation_fixes.sql` + rollback; browser moderation screens updated to set `acted_by` and detect rejected updates.
4. **Independent revalidation (Phase 18)** — two blind read-only audits (T01–T06, T07–T12). Findings triaged; every code-fixable defect fixed in the follow-up hardening session (see `15_INDEPENDENT_REAUDIT.md` for the defect ledger and `06_IMPLEMENTATION_CHANGELOG.md` for the fixes).
5. **Gates** — `tsc --noEmit`, `eslint --max-warnings=0`, `vitest run --maxWorkers=4`, `next build` (results in `12_AUTOMATED_TEST_RESULTS.md`).

## Technology choices (simplest-maintainable rule)

- No new frameworks, databases, accounts or cloud services were added.
- Public reads use the existing service-role admin client **only inside server routes/handlers**; the browser keeps the anon key with RLS as enforcement.
- `requestMemo` wraps React `cache` with an identity fallback (project React is 18.3.1 at test runtime; Next 16 vendors React 19 where `cache` is request-scoped) — verified no cross-request staleness path.
- T05 diagnostics store results in `agent_jobs.result` (no new snapshot table); deep mode is admin-API-only (`?deep=1`), worker job runs DB-only.

## Explicit non-goals this pass

- Applying production RLS/schema migrations (owner approval required).
- T04 ORCID profiles, T08 referrer analytics, T09 cross-links, T10 restore drill, T11 semantic search/spend cap, T12 CWV instrumentation — re-baselined as prioritized backlog in `02_ESUT_GAP_MATRIX.md`.
