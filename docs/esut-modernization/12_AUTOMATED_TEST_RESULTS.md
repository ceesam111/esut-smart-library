# ESUT Virtual Library — Automated Test Results

Environment: Windows 11, Node.js via `node <file>` invocation (PowerShell 5.1), Vitest 4.1.11, Next.js 16.4.0 (Turbopack). No fabricated logs — every number below comes from an actual run in this session.

## Gate results (final, post hardening session)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `node node_modules\typescript\bin\tsc --noEmit --incremental false` | **PASS** — exit 0, zero type errors |
| Lint | `node node_modules\eslint\bin\eslint.js . --max-warnings=0` | **PASS** — exit 0, zero warnings |
| Unit/integration tests | `node node_modules\vitest\vitest.mjs run --maxWorkers=2` | **PASS** — **95 files / 797 tests passed**, exit 0 |
| Production build | `node node_modules\next\dist\bin\next build` | **PASS** — exit 0; 58 static pages; all new routes present (`/api/theses`, `/api/theses/[id]`, `/api/theses/[id]/citation`, `/api/repository/[id]/citation`, `/api/admin/visibility`, `/api/oai`, `/theses-sitemap.xml`, `/repository-sitemap.xml`, `/catalog-sitemap.xml`, `/sitemap.xml`, `/sitemap-static.xml`, `/robots.txt`) |

Known environment noise (not failures): jsdom prints `Not implemented: getComputedStyle/getContext` warnings during component tests.

## Flakiness note (honest)

One intermediate full-suite run at `--maxWorkers=4` completed 93/95 files (782 tests, all passing) but two jsdom-heavy files (`src/lib/a11y.test.tsx`, `src/lib/i18n.component.test.tsx`) hit worker-start timeouts ("Timeout waiting for worker to respond") under machine load — vitest exit 1 due to unhandled worker errors, **not** test failures. Re-run at `--maxWorkers=2`: fully clean (95/95). Recommendation recorded: use `--maxWorkers=2` on constrained machines.

## Suites touched by this pass (with counts)

| Suite | Tests | Coverage |
|---|---|---|
| `src/server/thesis/publicThesis.test.ts` | 13 | embargo math, embargoed-file logic, published-only gate, scholarly mapping (Thesis JSON-LD, no file URL, citation tags), co-supervisor PII strip, degree-filter pattern mapping |
| `src/server/oai/service.test.ts` | 35 | six verbs, resumption (issue/expiry/forgery/round-trip, non-Latin-1 values), strict badArgument (stray args, token-alone, GetRecord from/until/set, List* identifier), date filtering, access control, XML conformance |
| `src/server/repository/citationExport.test.ts` | 5 | BibTeX/RIS structure, type mapping, newline citation-injection neutralization |
| `src/server/visibility/visibilityDiagnostics.test.ts` | 5 | gap classification, bounded probes, self-fetch behavior |

Remaining suites (86 files / 744 tests) unchanged and passing.

## What automated tests do NOT prove (production smoke list)

- Hosted database matches migration files (schema drift possible — `degree_programme` column was one discovered drift).
- Live PostgREST embed `patron:patrons!theses_patron_id_fkey` behavior.
- OAI end-to-end against a real harvester / external OAI validator.
- GSC/Scholar rendering of real pages; CWV numbers.
- RLS migration application (SQL not executed in CI — owner-gated).
