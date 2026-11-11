# 01 — Baseline Verification (Phase 22, §1)

Date: 2026-10-25/26. Method: read-only inspection first, no writes to tracked content.

## Repository state

| Check | Result |
|---|---|
| Git branch | `master` |
| HEAD | `9b060e5` |
| Working tree | 104 `git status --porcelain` entries (42 modified tracked files + untracked migrations/tests/dirs) — **nothing staged**, all Phase 22 code changes intentionally uncommitted |
| Commit `6ed0312` exists | **YES** — `git cat-file -e 6ed0312` exit 0 |
| `.env*` files | 8 present in project root; all 7 files later copied to a temp hold directory during staging attempts were re-verified **byte-for-byte identical by SHA-256** (`.env`, `.env.development`, `.env.development.example`, `.env.example`, `.env.new`, `.env.production`, `.env.production.example`); `.env.local` was never moved. No `.env*` file was modified at any point. |

## Untracked files inspected, not overwritten

Scratch/untracked material was listed and left untracked, per §1 ("do not stage or commit previously untracked BATCH reports, prompts, runbooks or scratch scripts"):

`BATCH12_34POINT_REPORT.md`, `BATCH14_52POINT_REPORT.md`, `BATCH15_57POINT_REPORT.md`, `ESUT_Smart_Library_Complete_Platform_Runbook.docx`, `next-prompt.md`, `next-prompt2.md`, `post-implementation-prompt.md`, `docs/complete-feature-inventory.md`, `docs/features-by-role-and-benchmark.md`, `docs/platform-capability-summary.md`, `scripts/*` state/shell scratch files, `scripts/__pycache__/`.

## Existing implementation reports read

All 16 prior reports in `docs/esut-modernization/` exist and were read as needed (01–16, including `14_INSTITUTIONAL_DEPENDENCIES.md` and `15_INDEPENDENT_REAUDIT.md`).

- `15_INDEPENDENT_REAUDIT.md` records the Phase 18 outcome: **37 findings** (21 from the T01–T06 audit + 16 from the T07–T12 audit), 3 HIGH (e.g. `theses_insert_own` missing status restriction → any patron could insert an already-published thesis), the rest MEDIUM/LOW — **all resolved**, with both blind audits independently re-confirming the GREEN gates of that phase.
- That audit's own baseline: `tsc` exit 0, ESLint exit 0, **95 test files / 797 passing tests**, `next build` exit 0. This is the §13 baseline of 797.

## Baseline of currently passing tests (re-established this session)

`npx vitest run --maxWorkers=1` on the untouched-at-the-time tree: **115 files / 997 tests passed** (exit 0, 231 s, archived at `shell/93b03809e2e7639fc0c9281dc6d79d10f66a7433/sh_174f0b1ae001imC61CXsjgjARb.out`). This exceeds the 797 baseline; the growth (997) comes from test files added during earlier Phase 22 work this session plus prior in-phase sessions, none of them removed or skipped.

## Configuration / infrastructure prerequisites identified

| Prerequisite | Status |
|---|---|
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_BASE_URL` build args | Must equal `https://virtuallibrary.esut.edu.ng` at build time — server code never reads `process.env.NEXT_PUBLIC_APP_*` for the base URL; `appBaseUrl()` = `APP_BASE_URL` else fallback `https://virtuallibrary.esut.edu.ng`. Local builds without the process-level env re-introduce `localhost:3000` inlining (the defect in live tag `20261023-0259`). Verified set correctly for this session's final builds. |
| `OAI_ENABLED`, `OAI_TOKEN_SECRET` | Not set in production env (owner-gated); behavior covered by new route tests for enabled/disabled configurations |
| Arcjet | Active on production — `/api/repository*` returned 403 to curl/automated probes this session (real-user impact undetermined); `/api/oai` exempt for harvesters |
| Cloudflare | Serves the origin; challenge-platform cookies caused the production-only CSRF defect (fixed, see 11) |
| Coolify deploy | Dockerimage flow, app UUID `dgbxbva96eayp8ktfc3guqi0`, live tag `20261023-0259`, rollback tag `20261020-2101`; Phase 22 image build/flip **not yet approved** |
| Supabase | Test project `rnnjspkdhojoigncdgmy`; anon-visible repository rows: 4 items (`1111…/2222…/3333…/4444…`), all `published/global` |
| Migration `20261011130000` | Present with rollback `rollback/20261011130000_rls_escalation_fixes.down.sql`; **not applied to production** (owner approval required — see 02/03) |
| Machine | 4 logical cores / 7.6 GB RAM with Docker + Defender load — drives the documented vitest accommodations (see 12) |

## Targeted regression checks on preserved features (T01, T02, T05, T06, T07)

§1 requires regression checks rather than assuming perfection. A focused vitest batch over the feature-relevant suites:

```
npx vitest run --maxWorkers=2 robots.test url-report canonical-url appBaseUrl
  oai/service extraction sip2 catalogue/security a11y.test i18n.component
  citationExport signposting openurl coar-notify emailService
→ Test Files 18 passed (18) | Tests 203 passed (203) | exit 0 | 51 s
```

Covers: robots/canonical URL/appBaseUrl (T02), URL report + extraction + SIP2 (T05), catalogue security, citation export BibTeX/RIS (T07), signposting/OpenURL/COAR (T01/T02), OAI-PMH service incl. resumption (T07), email service (workflow notifications), a11y + i18n component suites.

## Live read-only regression of the same features against production

§10 probe bodies archived in `C:\Users\LENOVO\AppData\Local\Temp\opencode\phase22-s10\` (status line evidence): `home 200`, `robots 200`, `sitemap-index/static/catalog/repository/theses 200`, `health 200`, `oai-identify/listrecords/noverb/badverb/badarg/unknownparam/xss 200`, `sru + sru-sqli 400` (parse-level CQL rejection), `theses 200`, `item-page 200`, `url-report 200`, `repository-api 403` (Arcjet), `citation-* 403` to curl (Arcjet; in-page POSTs reached the app pre-fix). OAI resumption tokens: unreachable with only 4 public records (documented honestly, see 10). No production resource was modified — every probe was GET or API-safe.

## Resolved problems (this phase, baseline stage)

1. Production-only defect confirmed on live: every non-Bearer, non-exempt POST returned 403 due to Cloudflare challenge cookies tripping `csrfFailure()` — root-caused and fixed (middleware-issued `csrf-token` cookie + client echo; see 11). Localhost-inlining defect in live image root-caused to build-time env (documented above); corrected in all builds made this session.

## Remaining issues / verification limits

- `accountid=189761` (ProQuest) appears in 3 build-output files as a legitimate ESUT subscription link in shipped content; `localhost:3000` = **0** and `explore.proquest.com` = **0** across all 2,228 scanned output files; `virtuallibrary.esut.edu.ng` = 14 (expected canonical references).
- Production JS payload measurement initially failed (script-tag regex matched 0 assets); recovered by extracting actual `<script src>` values — see 10 for final numbers.
- `supabase start` for isolated local staging initially failed on `.env.local`'s UTF-8 BOM (CLI parses env files itself); workaround + retry documented in 03.
