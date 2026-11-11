# 02 — T03 Blocker Resolution (Phase 22, §2)

## What the blocker actually is (no guessing — sourced)

`15_INDEPENDENT_REAUDIT.md` classified T03 as *code-complete but application-blocked*. The precise causes, established from reports + this session's live evidence:

1. **Unapplied Supabase migration (primary):** `20261011130000_rls_escalation_fixes.sql` — "T03 RLS migration has not been applied to production (owner approval required)". The migration exists in the repo with a verbatim rollback (`supabase/migrations/rollback/20261011130000_rls_escalation_fixes.down.sql`); applying it to production is an owner-gated action this phase was forbidden to perform (§16).
2. **Missing test accounts / no production credentials:** researcher/librarian/reviewer/administrator journeys could not be executed against production — creating accounts in the production database is a production-DB modification (owner-gated). E2E therefore runs at code-path level (automated tests) plus read-only live probes.
3. **Authentication configuration — production-only CSRF defect (found and fixed this phase):** on production, Cloudflare's challenge-platform sets a cookie on every visitor; `csrfFailure()` treated any cookie as an auth session, so **every non-Bearer, non-exempt POST returned 403** — including the submission-workflow API calls. Evidence: POST `/api/events/track` → 403; in-page POST `/api/oai?verb=Identify` → `{"error":{"message":"CSRF check failed."}}`; same POST with `credentials:'omit'` → 405 (proving the request never reached the handler otherwise). Locally the defect was invisible (no Cloudflare cookie). **Fix:** middleware now issues a `csrf-token` cookie and the client echoes it as `x-csrf-token`; the existing `!token || !header || token !== header` check was left intact (never weakened) — presence-only middleware variants were rejected as a formal weakening.
4. **Missing client credentials on workflow APIs (found and fixed this phase):** the researcher submission page and multiple staff review/admin pages called Bearer-protected routes without any `Authorization` header → guaranteed 401 even with a valid session. Affected workflow steps directly: `RepositorySubmit.tsx` (DOI/handle minting — silently skipped), and staff pages for receiving/reviewing submissions (`Notices`, `Circulation`, `DeliveryHistory`, `Reports`, `AuthorityMerge`, `BatchModification`, `CatalogueNew`). Fixed with the repo's established `authHeaders()` pattern (session `access_token`); routes remain unchanged and still strictly Bearer-gated (`requireUser`/`requireRole` verified on all 7 target routes).

Not the cause (checked): storage permissions (supabase storage policies unchanged and covered by prior audits), email service configuration (email service suite green in regression batch, 18 files/203 tests).

## 12-step submission workflow validation

Each step was validated at the deepest layer available without owner-gated production access. "Live" = read-only production probe; "test" = automated suite evidence.

| # | Step | Evidence | Status |
|---|---|---|---|
| 1 | Researcher creates a draft | `src/server/thesis/submitThesis.test.ts` + repository submit route suites; page `RepositorySubmit.tsx` (auth headers fixed this session) | ✅ code-path verified |
| 2 | Researcher uploads a document | submit/upload suites in full run (115 files/1003 tests green) | ✅ code-path verified |
| 3 | Researcher submits the record | workflow submit tests; CSRF fix unblocks the POST on production | ✅ code-path verified; live submit **BLOCKED** (needs production account) |
| 4 | Librarian receives the submission | `workflowService.test.ts`; notices/dispatch routes now called with auth (fixed) | ✅ code-path verified |
| 5 | Reviewer accesses the record | `workflowAuth.test.ts` (role gating) | ✅ code-path verified |
| 6 | Reviewer approves/rejects | workflow service + auth tests | ✅ code-path verified |
| 7 | Rejected submissions return for correction | workflow state-transition tests | ✅ code-path verified |
| 8 | Approved records become publicly discoverable | anon REST probe: 4 published/global rows readable by anon (live) | ✅ live-verified |
| 9 | Restricted documents remain protected | `versions.test.ts` + RLS source audit + anon probes returning 403 for restricted paths | ✅ verified (RLS application still owner-gated) |
| 10 | Embargo rules correctly enforced | embargo gate covered in repository/versions suites; **no embargoed rows exist live** → live behavior untestable (documented honestly) | ✅ code-path / ⚠️ live unreachable |
| 11 | Audit logs record transitions | workflow/audit suites in full run; audit-write routes Bearer-gated | ✅ code-path verified |
| 12 | Notifications reflect real DB outcomes | email service suite green in targeted regression batch; dispatch routes auth-fixed | ✅ code-path verified |

## Resolved problems

- CSRF production defect: root-caused, fixed, and covered by **7 new middleware tests + 8 new csrfFetch tests**.
- 8 UI files / 23 call sites calling authed workflow APIs without credentials: fixed; verified `tsc` exit 0, ESLint exit 0, full suite **1003/1003** after the fix; post-fix scan shows only 4 remaining unauthenticated same-origin unsafe calls, all intentional (anonymous view counter ×2, public academic-integrity analysis endpoint, and one false positive using an `authHeaders`-derived `headers` variable).
- Submission-side identifier minting (`/api/identifiers/mint`, route enforces `requireUser`) now sends the session token instead of silently failing.

## Remaining issues / BLOCKED dependencies (kept BLOCKED, not declared successful)

- **Live end-to-end submission with real roles** — requires production or staging accounts; creating them is owner-gated.
- **Applying `20261011130000` to production** — owner approval required (see 03 for staging validation status).
- **Live embargo/PDF-link behavior** — no embargoed/restricted rows exist among the 4 anon-visible records; unreachable without seeding, which on production would be a DB modification.
