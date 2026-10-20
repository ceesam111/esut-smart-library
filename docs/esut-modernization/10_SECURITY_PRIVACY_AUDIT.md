# ESUT Virtual Library — Security & Privacy Audit (T03/T05)

## Findings fixed in this pass

| Severity | Finding | Fix | Evidence |
|---|---|---|---|
| HIGH | Submitter could escalate own repository item (`repo_items_update_own` `WITH CHECK` allowed any status) | `status='submitted'` enforced in both USING and WITH CHECK; moderator policy separate | `20261011130000_rls_escalation_fixes.sql` §1 |
| HIGH | Submitter could insert a thesis already `published` (forged public ETD) | `theses_insert_own` `WITH CHECK` now excludes `published`/`approved` | §2 (blind-audit defect #1, fixed) |
| HIGH | `tw_insert` `WITH CHECK (true)` allowed audit-trail forgery | `WITH CHECK (acted_by = auth.uid())`; browser writers set `acted_by` | §3 + UI changes |
| HIGH | `/api/repository/versions` GET was unauthenticated (enumerated version rows incl. `file_url` for any item) | GET requires auth; private items owner/staff only; POST owner/staff only | `versions/route.ts` |
| HIGH | Anon `item_versions` read applied to all items | Scoped to published/global parent items (public Versions tab still works) | §4 |
| MEDIUM | Staff UPDATE policies gated on `auth.jwt()->>'role'='admin'` — unreachable for browser sessions (`role=authenticated`), so admin publish silently no-opped | Gated on `public.has_any_role(...)` over `user_roles`/`patrons` (SECURITY DEFINER) | §1c/§2b (blind-audit defect B1, fixed) |
| MEDIUM | Rollback restored wrong predecessor policies for `ts_*`/`tw_insert` (first-gen `WITH CHECK(true)` instead of the scoped `20260621002011` versions) | Rollback rewritten to restore predecessors **verbatim**; `ts_*` no longer touched by the up-migration (already scoped) | rollback file (defect B2, fixed) |
| MEDIUM | Co-supervisor emails/ORCIDs leaked to anon via `/api/theses` | Public payload keeps `name` only | `publicThesis.ts` (test-covered) |
| MEDIUM | Embargoed thesis files downloadable by any signed-in user once visibility worked; visibility gate never satisfiable (`visibility` always `'private'`) | Public download branch = `status='published'` **and not embargoed** | `secureThesisDownload.ts` |
| MEDIUM | `/api/theses` 500 on commas/quotes in search (PostgREST `.or()` splitting) + raw DB error echoed | Sanitizer strips `,` and `'`; generic error messages | `publicThesis.ts`, theses routes |
| LOW | Citation export newline injection (forged BibTeX/RIS fields) | CR/LF neutralized in both exporters (test-covered) | `citationExport.ts` |
| LOW | Malformed `%` in URLs → 500 in catch-all/citation routes | Decode wrapped; falls through to 404/noindex | `page.tsx`, citation routes |
| LOW | `/api/admin/visibility` returned 500 for unauthenticated calls | 401/403/500 mapping | route |

## Standing security controls (verified)

- RLS is the enforcement layer for the anon browser client; service-role client confined to server routes/handlers (audits confirmed no server-module import from client code).
- Public gates never expose patrons (only `full_name` via server-side embed), `file_url`, `approval_date`, `embargo` internals.
- Middleware: CSRF check for cookie-authed unsafe methods, origin allowlist, Arcjet shield on sensitive API prefixes, rate limits, security headers (CSP/HSTS/frame-deny/nosniff), noindex for private surfaces.
- Deep diagnostics probes: fixed `doi.org` host, `encodeURIComponent`, 25-item cap, 5 s timeout, 4 kB body cap (SSRF-safe — audit-verified).
- Privileged-role grant restricted to super admins (DB policy + UI list, defense in depth).

## Privacy

- Public surfaces minimize data: author display name only; supervisor display names only; no emails (enforced by the co-supervisor fix and `ts_read` being authenticated-only).
- Analytics/diagnostics store no personal data; deep checks touch only public DOI/sitemap endpoints.

## Unresolved / owner actions

1. **Apply `20261011130000_rls_escalation_fixes.sql` in production (owner approval required)** — rollback file provided; until applied, all escalation gaps above remain open on production.
2. `versions_read` (authenticated) still `USING (true)` — pre-existing; recommended follow-up policy scoping to owner/staff/public-parent.
3. Pre-existing: supervisor/admin direct browser UPDATE of `theses` rows was RLS-blocked even before this pass; the `/api/workflows` transition API is the functioning path. A supervisor-scoped policy can be added later if product requires direct updates.
4. GitHub PAT rotation, Resend DNS verification, optional keys (`SEMANTIC_SCHOLAR_KEY`, `DISCOURSE`, `AI_GATEWAY`), Turnstile decision — standing items from the deployment report.
5. MFA for privileged accounts and backup encryption are Supabase/hosting configuration items — not verifiable from the repository.
