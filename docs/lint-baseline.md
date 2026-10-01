# Lint Baseline — ESUT Smart Library

Honest snapshot of the repository's ESLint state so that "lint is green" can never be
confused with "the whole repo is lint-clean".

## How the numbers were produced

| Item | Value |
|---|---|
| Date | 2026-09-30 |
| Command | `node node_modules\eslint\bin\eslint.js . -f json -o eslint-full.json` |
| Why not `npm run lint` | `npm.ps1` is blocked by PowerShell execution policy on this machine; `npm.cmd run lint` exceeds a 10-minute budget because the same ESLint pass runs |
| Config | repository `.eslintrc` / `eslint.config` as shipped — no rules disabled for this run |
| Files scanned | **627** |
| Files with at least one problem | **261** |
| Errors | **669** |
| Warnings | **309** |
| Total problems | **978** |
| Exit code | 1 (errors present) |
| Files excluded | **0** — nothing is ignored via config for this run |

## Rule breakdown (top rules by count)

| Rule | Count | Kind |
|---|---:|---|
| `@typescript-eslint/no-misused-promises` | 303 | error |
| `@typescript-eslint/no-explicit-any` | 273 | warning |
| `@typescript-eslint/no-floating-promises` | 208 | error |
| `@typescript-eslint/no-unused-vars` | 46 | warning |
| `no-console` | 33 | warning |
| `no-duplicate-imports` | 6 | error/warning |
| `no-useless-assignment` | 4 | error |
| `react-hooks/exhaustive-deps` | 4 | warning |
| `prefer-const` | 3 | error |
| `@typescript-eslint/no-unused-expressions` | 3 | error |
| `no-empty` | 2 | error |
| `@typescript-eslint/no-empty-object-type` | 1 | error |

Three rules (`no-misused-promises`, `no-explicit-any`, `no-floating-promises`) account for
**79%** of every problem in the repository. They are mechanical, not architectural.

## Worst 15 files (errors / warnings)

```
src/app-pages/admin/Serials.tsx          28 /  2
src/app-pages/admin/Acquisitions.tsx     24 /  3
src/app-pages/admin/Circulation.tsx      17 /  6
src/app-pages/admin/Catalogue.tsx        16 /  0
src/app-pages/admin/Repository.tsx       15 / 15
src/app-pages/admin/Blog.tsx             15 /  2
src/app-pages/admin/Accounts.tsx         15 /  0
src/app-pages/Forum.tsx                  13 /  2
src/app-pages/admin/Agents.tsx           12 /  1
src/app-pages/CatalogueItem.tsx          11 / 18
src/app-pages/admin/Consortium.tsx       11 /  1
src/app-pages/AILibrarian.tsx            10 /  5
src/app-pages/lecturer/ReadingLists.tsx  10 /  5
src/app-pages/BookClubs.tsx              10 /  3
src/app-pages/admin/Requests.tsx         10 /  0
```

These are legacy pages accumulated before the current repair batches. They are **not**
covered by the per-batch gate.

## The gate used for repair batches

A repair batch does **not** claim "the repo lints clean". It claims:

> Every file touched by this batch has **0 errors and 0 warnings**.

Verified with an explicit file list, e.g.:

```
node node_modules\eslint\bin\eslint.js "src/server/thesis/**" "app/api/thesis/**" "src/lib/thesisFields.ts" "src/lib/thesisFile.ts" "src/components/ThesisFileButton.tsx" "src/app-pages/ThesisSubmit.tsx" "src/app-pages/supervisor/Theses.tsx" "src/app-pages/admin/Theses.tsx"
```

Batch 7 changed-file status on 2026-09-30:

| File | Errors | Warnings |
|---|---:|---:|
| `src/server/thesis/submitThesis.ts` | 0 | 0 |
| `src/server/thesis/submitThesis.test.ts` | 0 | 0 |
| `src/server/thesis/secureThesisDownload.ts` | 0 | 0 |
| `app/api/thesis/submit/route.ts` | 0 | 0 |
| `app/api/thesis/download/route.ts` | 0 | 0 |
| `src/lib/thesisFields.ts` | 0 | 0 |
| `src/lib/thesisFile.ts` | 0 | 0 |
| `src/components/ThesisFileButton.tsx` | 0 | 0 |
| `src/app-pages/ThesisSubmit.tsx` | 0 | 0 |
| `src/app-pages/supervisor/Theses.tsx` | 0 | 0 |
| `src/app-pages/admin/Theses.tsx` | 0 | 0 |
| `scripts/e2e-workflow-live.ts` | 0 | 0 |

## What this does and does not prove

It proves the files changed in this batch introduce no new lint findings under the
repository's own configuration.

It does **not** prove the repository as a whole is lint-clean (669 errors remain in
untouched legacy files), and it does not prove correctness, security or accessibility.
