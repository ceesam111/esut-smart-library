# ESUT Virtual Library — Independent Re-Audit (Phase 18)

Method: two **blind, read-only** audits by independent explore agents with no access to the implementer's claims — one over T01–T06, one over T07–T12 plus cross-cutting regression hunting. Both were instructed to assume defects and cite proving code. Each audit ran its own `tsc --noEmit` (exit 0) and targeted vitest suites.

## Outcome of the audits

- **37 findings total** (21 from the T01–T06 audit, 16 from the T07–T12 audit): 3 HIGH + several MEDIUM defects in freshly written code (including two sign-off blockers in the T03 RLS migration), rest MEDIUM/LOW/nits.
- Both audits independently confirmed the previously claimed GREEN gates and verified the T02/T05/T06/T07 core implementations as working with citations.

## Defect ledger and resolution

| # | Sev | Defect (audit citation) | Resolution |
|---|---|---|---|
| A1 | HIGH | `theses_insert_own` lacked status restriction — any patron could insert a thesis already `published`, instantly public | FIXED — `status NOT IN ('published','approved')` in WITH CHECK |
| A2 | HIGH | `versions_read_anon` dropped (broke public Versions tab) while `/api/repository/versions` GET stayed unauthenticated (the actual leak) | FIXED — anon read scoped to published/global parent items; GET authz-gated (public/owner/staff); POST owner/staff only |
| A3 | HIGH | Dropping `tw_insert` broke live browser audit writes (`admin/Theses.tsx`, `supervisor/Theses.tsx`) — premise "service-role only" was false | FIXED — policy kept as `WITH CHECK (acted_by = auth.uid())`; writers set `acted_by` |
| B1 | HIGH | Staff UPDATE policies gated on `auth.jwt()->>'role'='admin'` — unreachable for browser JWTs (`role=authenticated`); admin publish still no-opped | FIXED — `public.has_any_role(...)` over `user_roles`/`patrons` |
| B2 | HIGH | Rollback restored first-gen `WITH CHECK(true)` policies instead of the actual scoped predecessors (`20260621002011:122-133`) | FIXED — rollback rewritten verbatim; `ts_*` untouched by up-migration (already scoped) |
| A4 | MED-HIGH | Degree filter values (`PhD`, `Masters`…) never matched stored degrees (`Ph.D.`…) → filter always empty | FIXED — server-side pattern mapping (`degree.ilike` variants), test-covered |
| A5 | MEDIUM | Co-supervisor emails/ORCIDs serialized to anon | FIXED — name-only public payload, test-covered |
| A6 | MEDIUM | ThesisDetail copy-citation had no failure path (false "Copied!") | FIXED — `.then/.catch` |
| A7 | MEDIUM | Download gate required `visibility='global'` (never set) and ignored embargo | FIXED — public branch = `status='published'` AND not embargoed |
| A9 | LOW-MED | `/api/theses` 500 on comma/quote in search + raw DB errors echoed | FIXED — sanitizer strips `,'`; generic messages |
| A10 | LOW | Admin visibility route returned 500 for unauthenticated | FIXED — 401/403/500 mapping |
| A11 | LOW | Unguarded `decodeURIComponent` → 500s in catch-all/citation routes | FIXED — safe decode |
| A12 | LOW | `/thesis/submit`, `/thesis/status` missing from robots/noindex | FIXED — added to both |
| A13 | LOW | Keyless React fragment | FIXED — `Fragment key` |
| A14 | LOW | Citation newline injection (BibTeX/RIS forgery) | FIXED — CR/LF neutralized, test-covered |
| A15 | LOW | Old `/thesis` portal permanently empty (anon `theses` reads) | FIXED — reads `/api/theses` |
| B3 | MEDIUM | `__metrics` served before `OAI_ENABLED` gate | FIXED |
| B4/B5 | MEDIUM | GetRecord ignored from/until/set; List* ignored identifier; unknown params silently discarded | FIXED + 3 new tests |
| B6 | MEDIUM | `/api/oai` not rate-limited in middleware | FIXED (Arcjet bot-filter deliberately excluded so harvesters aren't blocked) |
| B11/B12 | LOW | XML escaping kept control chars; `btoa` non-Latin1 tokens throw | FIXED (charCode filter; UTF-8-safe base64) + test |
| B13 | LOW | Search sanitizer missed `,`/`'` | FIXED |
| B15/B16 | LOW | Missing `role="alert"`; stray new JSDoc comment | FIXED |
| B1 part 2 | MEDIUM | Repository admin UI optimistically proceeded on failed updates (even emailed rejection) | FIXED — `.select('id')` row-count verification on update/reject/publish-fallback |
| A17 | NIT | Owner-read regression for legacy `submitter_id NULL` theses | NOT A DEFECT — old `theses_own` was patron-link-scoped (verified `20260620202651:236`); new policies keep the patron-link predicate AND add `submitter_id` |
| A18 | NIT | Dead `'draft' branches in repo policies | FIXED — real status set used |
| B7–B10 | — | T08/T09/T10/T11 feature gaps | Honest PARTIAL, re-baselined in gap matrix (no code claim made) |
| Misc | PRE-EXISTING | `versions_read` authenticated `USING(true)`; supervisor direct theses UPDATE blocked (syncWorkflow API is the working path); `dashboard/Settings.tsx` selects non-existent `degree_programme`; anon view/download counters ineffective under RLS; middleware→proxy.ts deprecation (Next 16); `publicPdfUrl` rejects `http://` (dev-only impact) | Documented in `10_SECURITY_PRIVACY_AUDIT.md` / gap matrix as follow-ups — not regressions of this pass |

## Re-validation after fixes

All fixes were applied, then the four gates re-run from scratch: `tsc` exit 0, `eslint --max-warnings=0` exit 0, vitest **95 files / 797 tests passed** exit 0, `next build` exit 0 (see `12_AUTOMATED_TEST_RESULTS.md`). The corrected migration and rollback were re-checked line-by-line against the predecessor policies in `20260620202651`, `20260620202944`, `20260621002011`.

## Sign-off judgment

The implementation is fit for owner review and production application, with the explicit caveat that **the T03 RLS migration has not been applied to production** (owner approval required) and T04/T08–T12 remain documented PARTIALs.
