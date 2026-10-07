# Batch 17A — Lint Forensic Baseline & Restoration Plan

- **Project**: ESUT Smart Library (ESUT Library Platform)
- **Date**: 2026-10-06
- **Gate command**: `node node_modules\eslint\bin\eslint.js . --max-warnings=0` (same as `npm run lint`; CI runs `npx eslint . --max-warnings=0`)
- **Baseline capture**: full-repo run, JSON output, machine-counted (severity 2 = error, 1 = warning)

## 1. Baseline before any Batch 17 changes (HEAD after Batch 16)

| Metric | Count |
|---|---:|
| Errors | 633 |
| Warnings | 286 |
| Total problems | 919 |
| Files with problems | 201 of 719 |
| Exit code | 1 (RED — CI would fail) |

Historical context: Batch 2 recorded ~662 errors before the Batch 16 dead-code
deletions (`src/views/**`, Vite remnants) removed part of the load.

## 2. Categorization table (Category | Count | Rule | Files | Severity | Root cause | Planned resolution)

| # | Category | Count | Rule | Files | Severity | Root cause | Planned resolution |
|---|---|---:|---|---:|---|---|---|
| 1 | Async function in JSX event attribute (React fire-and-forget) | 296 | `@typescript-eslint/no-misused-promises` | ~90 | error | React event attributes ignore return values; project-wide `checksVoidReturn.attributes` on by default | Configure rule option `checksVoidReturn: { attributes: false }` (documented typescript-eslint React tuning, rule stays **error** for arguments/properties/returns/variables) + document justification (§5) |
| 2 | Async function in non-void argument position | 6 | `@typescript-eslint/no-misused-promises` | 6 | error | callbacks (e.g. `forEach(async …)`, `setTimeout(async …)`) passed where void return expected | **Fix in code** — restructure to `for…of`/`void`/sync wrapper |
| 3 | Floating promises | 233 | `@typescript-eslint/no-floating-promises` | 99 | error | intentional fire-and-forget calls and awaited-in-async calls without `await`/`void`/`.catch` | **Fix in code** — `await` inside async contexts, `void` operator or `.catch` for intentional fire-and-forget |
| 4 | Unsafe `any` | 257 | `@typescript-eslint/no-explicit-any` | 73 | warn (gate fails: `--max-warnings=0`) | untyped API/JSON boundaries, `catch (err: any)`, `window as any`, untyped params | **Fix in code** — real types, `unknown` + narrowing at JSON boundaries, narrow DOM casts (also raise rule to `error`, aligning with typescript-eslint `recommended`) |
| 5 | Unused variables/imports/args | 48 | `@typescript-eslint/no-unused-vars` | 37 | error | leftovers from refactors | **Fix in code** — remove; prefix genuinely intentional with `_` only per existing `^_` convention |
| 6 | Parser project failures (files outside `tsconfig.json`) | 28 | *(parse error, no rule)* | 28 | error | `parserOptions.project: "./tsconfig.json"` applies TS project parsing to `.mjs`/`.cjs`/`public/sw.js` and to `supabase/functions/**` (excluded from tsconfig because of Deno types) | **Fix config properly** — scope type-aware parsing to `**/*.{ts,tsx}` with `projectService: true` + `allowDefaultProject` for Supabase edge functions; plain JS files lint with default parser |
| 7 | React hooks plugin not registered | 4 | `react-hooks/exhaustive-deps` *(“Definition not found”)* | 4 | error | 4 stale `eslint-disable` comments reference a rule that was never configured; plugin installed only transitively | **Fix config properly** — register `eslint-plugin-react-hooks` (explicit devDependency) with `rules-of-hooks: error` + `exhaustive-deps: error`; **remove the 4 disable comments and fix any real deps violations in code** |
| 8 | Stale unused `eslint-disable` directives | 3 | *(none — linter directive report)* | 3 | warn | leftover suppressions | **Remove the comments** (no suppressions retained) |
| 9 | Duplicate import statements | 6 | `no-duplicate-imports` | 6 | error | sloppy edits | **Fix in code** — merge imports |
| 10 | `console.*` in CLI scripts | 26 | `no-console` | 10 | warn | rule allows only `warn`/`error`; seed/migration/verification scripts print progress to stdout | 3 files (root scripts) are dead → **deleted**. Remaining: **scoped config override for `scripts/**` only** (documented §5) + fix the one hit in app code (`admin/PatronsImport.tsx`) |
| 11 | Misc code smells | 13 | `no-unused-expressions` 3, `no-useless-assignment` 3, `prefer-const` 2, `no-empty` 2, `@typescript-eslint/no-empty-object-type` 1, `no-useless-escape` 1 | ~10 | error | routine cleanup | **Fix in code** |

## 3. Dead-code pass (performed before line-by-line fixes)

Deleted with `git rm` after zero-reference verification (project-wide grep across
`.ts/.tsx/.mjs/.js/.json/.yml/.md`, plus package scripts, Docker and workflow files):

| File | Evidence | Lint problems removed |
|---|---|---:|
| `check_errors.ts` (root) | zero references anywhere | 1 |
| `create_bucket.ts` (root) | zero references anywhere | 3 |
| `run_worker.ts` (root) | worker entrypoint is `tsx worker/index.ts` (`package.json` script `worker`) | 2 |
| `src/app-pages/admin/AuthorityLookup.tsx` | no import/reference outside itself | 1 |
| `src/app-pages/admin/AuthorityLinking.tsx` | no import/reference outside itself | 0 |
| `src/components/wellbeing/games/ColourMatch.tsx` | no import/reference outside itself | 0 |

Kept after review (evidence-based, not deleted):
- `src/components/ui/*` (31 unreferenced shadcn/ui primitives): design-system inventory,
  contributes **0** lint problems; deletion adds risk without gate benefit.
- `src/components/ui/ComingSoon.tsx`: referenced by `FacultyLibraries.tsx` and `LibraryBranch.tsx`.
- `src/hooks/*`: no unreferenced hooks found; no `src/providers` directory exists.

## 4. Framework/config review findings

- `eslint.config.mjs` used a single global `parserOptions.project` for **all** files
  including `.mjs`/`.cjs`/JS — root cause of category 6. Replaced with a
  TS-files-only type-aware block (`projectService`, see §5).
- `typescript-eslint` 8.71.0 (supports `projectService`), ESLint 10.11.0.
- `@typescript-eslint/parser` was imported directly although only present transitively
  (phantom dependency). The rewritten config imports the parser only via
  `typescript-eslint`’s bundled config — phantom import removed.
- `eslint-plugin-react-hooks` 7.1.1 present only transitively (via `eslint-config-next`)
  but will now be imported by the config → declared as an explicit devDependency
  (Batch 16 phantom-dependency lesson).
- `next.config.mjs` still carried the legacy `eslint: { ignoreDuringBuilds: true }` key.
  Next 16 no longer runs ESLint during `next build`; key removed, lint remains enforced
  by `npm run lint` and CI.
- `react-hooks` disable comments (category 7) and 3 unused disable directives
  (category 8) are the only `eslint-disable` comments in scope of the baseline —
  all are being removed, none retained.

## 5. Documented rule configurations (not suppressions)

1. **`@typescript-eslint/no-misused-promises` → `error` with
   `checksVoidReturn: { attributes: false }`.**
   React event-handler attributes (`onClick`, `onChange`, …) are consumed by React’s
   event system, which ignores return values; typescript-eslint documents this option
   for React codebases. The rule remains **error** for argument, property, return and
   variable positions — the 6 argument-position violations are fixed in code.
   No severity is reduced anywhere; nothing is set to `off`.
2. **`scripts/**` → `no-console: off` (scoped override).**
   Console output *is* the user interface of CLI scripts (seeding, migration,
   smoke tests, verification). Application, server and component code keep
   `no-console: warn` under `--max-warnings=0`, i.e. effectively enforced.
3. **Plain JS files (`.js/.mjs/.cjs`) → type-aware rules not applied.**
   They are outside every tsconfig; type-aware rules cannot produce valid results
   there. They still lint with `js.configs.recommended` + all base rules.

## 6. Progress log

| Milestone | Errors | Warnings | Total | Note |
|---|---:|---:|---:|---|
| Baseline (post-Batch-16) | 633 | 286 | 919 | §1 |
| After dead-code pass (6 files) | — | — | — | §3 |
| After config restoration (typed rules, react-hooks registration, scoped overrides) | — | — | — | §4, §5 |
| Mid-session checkpoints during code fixes | 122 → 15 | 0 | — | sequential code fixes, no suppressions |
| **Final (Batch 17A DoD: exit 0)** | **0** | **0** | **0** | 2026-10-07, `npm run lint` |

During the Batch 17 `any` → real types rework, TypeScript errors rose from 0
(HEAD `bb70cae`) to 182 across 44 files (handler context typed as `unknown`,
`Record<string, unknown>` boundaries, helpers hoisted out of effects leaving
orphaned call sites, Supabase responses read without `.data`). All 182 were
fixed with type-level, behavior-preserving edits (casts at JSON/response
boundaries, `useCallback` hoists, `SupabaseClient` typing of worker context
helpers) — **no `any` introduced, no `eslint-disable`, no config/severity
changes**. Verification worktree for the clean HEAD baseline:
`git worktree` at `bb70cae` (0 tsc errors).

## 7. Acceptance evidence (2026-10-07)

| Gate | Command | Result | Limitations |
|---|---|---|---|
| Lint | `npm run lint` (`eslint . --max-warnings=0`) | **exit 0 — 0 errors, 0 warnings** | static analysis only |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | **exit 0 — 0 errors** | no runtime guarantee |
| Unit tests | `npm test` (vitest run) | **exit 0 — 85 files, 696/696 passed** | no live Supabase/AI calls |
| Production build | `npm run build` (next build) | **exit 0** — all routes compiled | no deployment/preview performed |

Before/after by category: §2 table (11 categories, 919 problems) → final 0/0.
Accessibility (17C) and i18n (17B) phases are **not** covered by this document.
