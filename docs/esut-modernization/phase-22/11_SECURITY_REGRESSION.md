# 11 — Security and Regression Verification (Phase 22, §11)

Method: (a) re-verify each §11 security item against code + tests, (b) re-run feature regressions for preserved modules, (c) probe live production read-only. No production resource was modified.

## §11 security audit — item by item

| # | Item | Evidence | Status |
|---|---|---|---|
| 1 | Row-Level Security policies | Source line-by-line review of `20261011130000_rls_escalation_fixes.sql` (policies verified present: `theses_insert_own` with status restriction, `has_any_role(...)` staff gates, `tw_insert acted_by = auth.uid()`, `versions_read_anon`); anon REST probes confirm only `published/global` rows readable (4 items). Real-role staging validation status → 03. | ✅ verified in code; ⚠️ staging application owner-gated |
| 2 | Administrator permissions | All staff routes verified Bearer-gated this session (`requireRole`/`requireUser` on frameworks, marc-import, z3950-targets, templates, test-send, dispatch, builder, batch-modify, authorities, mint, reports, notices, analytics). **Defect found:** 8 UI pages called these routes with no `Authorization` header → 401 — fixed (see #15). | ✅ |
| 3 | Thesis download authorization | Route tests + anon probes: unauthorized download paths return 403; public files downloadable only for published/global records. | ✅ |
| 4 | Versions API authorization | `src/server/repository/versions.test.ts` green; anon cannot read private versions (`versions_read_anon` limited to visible records). | ✅ |
| 5 | File upload validation | Upload suites in full run (115 files / 1003 tests) — type/size/extension checks green. | ✅ |
| 6 | Embargo protection | Embargo gates in repository suites; code-path verified; live embargo rows do not exist (documented in 02). | ✅ code-path |
| 7 | API authentication | Route-guard scan this session: every admin/staff mutation route enforces Bearer auth. | ✅ |
| 8 | Server-side authorization | No trusted-client pattern found; all privilege checks server-side (`requireRole` + RLS). | ✅ |
| 9 | Rate limiting | OAI live-tested at 120 req/min (earlier phase, still green in regression batch); academic-integrity route 10 req/hour verified in source this session. | ✅ |
| 10 | Error messages | Live probes: SRU malformed CQL → 400 parse-level; OAI `badVerb`/`badArgument`/unknown-param/XSS probes → correct OAI-PMH error XML with no stack traces or SQL leakage. | ✅ |
| 11 | Sensitive logging | No secrets printed anywhere this session (env files read only for hashing; build args passed via env, never argv). | ✅ |
| 12 | Input validation | SQLi probe through SRU → 400 `Malformed CQL` (rejected at parse level); XSS probe through OAI → sanitized OAI error; `operation=zebra` → 400 diagnostic 1/1. | ✅ live-verified |
| 13 | Session handling | Supabase session tokens only; CSRF cookie is `httpOnly: false` **by necessity** (client must echo it) but `sameSite=lax`, `secure` in production, 7-day maxAge — equivalent to a double-submit token pattern. Existing strict check `!token || !header || token !== header` unchanged. | ✅ |
| 14 | Database access | Server-side only with RLS + service-role separation; no credentials in build output (artifact gate: no secrets, `localhost:3000` = 0 in 2,228 files). | ✅ |
| 15 | **CSRF** | **Production-only defect found live this phase:** any cookie (e.g. Cloudflare challenge-platform) tripped `csrfFailure()` → every non-Bearer non-exempt POST 403'd (evidence: `/api/events/track` 403; in-page `/api/oai` POST → `CSRF check failed`; `credentials:'omit'` → 405). **Fixed:** middleware issues `csrf-token` cookie (path `/`, sameSite lax, secure in production, maxAge 604800, issued only when absent); client `src/lib/csrfFetch.ts` echoes `x-csrf-token` for unsafe same-origin `/api/` calls. Presence-only middleware variant **rejected as a formal weakening**. 15 new tests (7 middleware + 8 csrfFetch). | ✅ fixed in code |
| 16 | Anonymous reads | Live anon REST + page probes: home/robots/sitemaps/OAI/item-page 200; restricted API paths → 403/401; repository detail page renders correctly for anon (earlier "Item not found" claim was false — contaminated grep, string never existed in `en.ts`). | ✅ |
| 17 | Ownership and approval states | Workflow suites (`workflowService`, `workflowAuth`, `submitThesis`) green; approval transitions server-enforced. | ✅ |
| 18 | Version visibility | Same as #4; published-only visibility gate shared by UI, search and API. | ✅ |

**Zero unresolved critical security findings in the code** — the two critical defects found this phase (CSRF production breakage; missing client credentials on 8 workflow pages) are both fixed and tested. **Honest caveat:** production still runs image `20261023-0259`, so the live system retains both defects until an approved build/flip (→ 13/15).

## Regression checks on preserved features (T01, T02, T05–T07)

```
npx vitest run --maxWorkers=2 robots.test url-report canonical-url appBaseUrl
  oai/service extraction sip2 catalogue/security a11y.test i18n.component
  citationExport signposting openurl coar-notify emailService
→ Test Files 18 passed | Tests 203 passed | exit 0 | 51 s
```

Plus targeted live probes (all GET/read-only): robots 200, 5 sitemaps 200, URL report 200, OAI identify/list-records 200, OAI error-verb matrix correct, SRU 400 on bad CQL, item page 200 (SSR 11,922 B with canonical + citation metas + JSON-LD), home 200.

## Regression risks from this phase's changes

| Change | Risk surface | Verification |
|---|---|---|
| Middleware cookie issuance | every response | 7 middleware tests; build 0; live-equivalent cookie logic only fires when `csrf-token` absent |
| Global fetch patch (`csrfFetch`) | every same-origin unsafe `/api/` call | 8 tests; patch scoped (method + origin + token present + header absent); Bearer/non-API calls untouched — full suite 1003/1003 |
| 8 pages `authHeaders()` | staff workflows | tsc 0, eslint 0; post-fix raw-fetch scan shows only 4 intentional remains |
| Global Search dual-source | search results | 6 localSearch tests; live `search-anon 200` correct |

## Verification result

`vitest` final: 115 files / 1003 tests / exit 0 · targeted regression: 18 files / 203 tests / exit 0 · `tsc` 0 · eslint 0 · `next build` 0 · artifact gate clean.
