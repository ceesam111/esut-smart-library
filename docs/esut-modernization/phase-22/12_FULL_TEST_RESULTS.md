# 12 — Full Test Results (Phase 22, §13)

## Summary

| Run | Files | Tests | Result | Duration |
|---|---|---|---|---|
| Baseline (prior phase, `15_INDEPENDENT_REAUDIT`) | 95 | **797 passed** | exit 0 | — |
| Intermediate full run (archive `sh_174f0b1ae001imC61CXsjgjARb.out`, ended 14:25:30) | 115 | **997 passed** | exit 0 | 231 s |
| **Final authoritative full run** (post all Phase 22 fixes) | **115** | **1003 passed / 1003** | **exit 0** | **93.02 s** |
| Targeted regression batch (T01/T02/T05–T07) | 18 | **203 passed / 203** | exit 0 | 51 s |
| Parallel attempt (2026-10-26, **without** `--maxWorkers=1`) | 114 of 115 | 989 passed / 995 run — **6 load-timeout failures**, 1 file not started | exit 1 | 906 s — **invalid, see flaky cause 5** |
| **Final-state serial re-run** (2026-10-26, after all deliverables) | **115** | **1003 passed / 1003** | **exit 0** | 691.44 s (machine loaded) |

Commands: `npx vitest run --maxWorkers=1` (full), `npx vitest run --maxWorkers=2 <file list>` (regression batch).

### 997 → 1003 delta — explained honestly

`app/api/oai/route.test.ts` was finalized at **14:26:18**, *after* the 997-run completed at 14:25:30 (file mtimes verified). During an incident in this session the file was briefly overwritten with only the 3 new `OAI_ENABLED` gate tests; it was then recovered from `git show HEAD:…` (6 `oaiXml` helper tests) and merged with the 3 gate tests → **9 tests**. The +6 delta is exactly those 6 recovered helper tests: 997 − 3 + 9 = 1003. No test was skipped, disabled or deleted at any point.

## Test-count growth 797 → 1003 (+206)

Growth comes entirely from **new** suites/files added across Phase 22 sessions. New or heavily extended this session/phase:

| Suite | Tests | Covers |
|---|---|---|
| `middleware.test.ts` (new) | 7 | `csrf-token` cookie issuance, scope, secure/sameSite/maxAge, non-issue when present |
| `src/lib/csrfFetch.test.ts` (new) | 8 | echo rules (method/origin/token/header conditions) |
| `app/api/oai/route.test.ts` (recovered+extended) | 9 | OAI error semantics + `OAI_ENABLED` on/off gate |
| `src/server/resources/localSearch.test.ts` (new) | 6 | dual-source search, `result_type`, public gate |
| `src/server/ai/researchGrounding.test.ts` | — | citation accuracy, relevance, groundedness, no-fabrication |
| `src/server/ai/tokenBudget.test.ts` | — | cost/abuse limits |
| `src/server/analytics/visibility.test.ts` | — | visibility metrics |
| `src/server/preservation/backups.test.ts`, `retention.test.ts` | — | backup status, retention rules |
| `src/server/seo/appBaseUrl.test.ts`, `app/robots.test.ts` | — | canonical base URL, robots |
| identity suites (`src/server/identity/`) | — | duplicate names, affiliation, ORCID format |

No test was removed; `vitest.config.ts` only gained include coverage for the new `middleware.test.ts`/`csrfFetch.test.ts`.

## Type / lint / build gates (final)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npx eslint <changed files + new tests>` | **exit 0** (no new `any`, no new `eslint-disable`) |
| `npx next build` (with `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_APP_BASE_URL` = `https://virtuallibrary.esut.edu.ng`) | **exit 0** (proxy/middleware active) |
| Inline artifact gate | 2,228 output files: `localhost:3000` = **0**, `explore.proquest.com` = **0**, `accountid=189761` = 3 (ESUT's own public ProQuest subscription link in shipped content — verified as content, not a leak), `virtuallibrary.esut.edu.ng` = 14 (expected canonical) |

## Flaky-test documentation (honest causes, §13 mandate)

1. **vitest timeout patch (untracked `node_modules` change):** in `node_modules/vitest/dist/chunks/cli-api.CnMVyzaz.js` the worker/collect timeouts (`START_TIMEOUT`, `WORKER_START_TIMEOUT`, 6e4/9e4 ms) were raised to **3e5 ms**. This is an *environment accommodation*, not a test change: **no config or env override exists in the repo** that would give the same effect (verified — `vitest.config.ts` has no timeout bump for these phases). It patches only `node_modules`, which is untracked and discarded on reinstall. Rationale: with the CLI's startup overhead on this machine, 90 s was occasionally insufficient for worker boot on the first run of a cold 115-file suite.
2. **Machine constraints:** 4 logical cores / 7.6 GB RAM with Docker (vmmemWSL), OpenCode and Windows Defender concurrently loaded — worker startup and jsdom collection are slow. Serial `--maxWorkers=1` is the proven-safe full-suite configuration; it produced zero flaky results across the final runs.
3. **jsdom warnings:** `canvas`/`getComputedStyle` warnings from jsdom are **benign** environment noise from the a11y/component suites — they do not fail tests and are unrelated to application code.
4. **Network flakes during live probes:** transient DNS/connect failures (and one old-curl `--compressed` unsupported error) affected *probe scripts only*, never the suite; probes were retried per item until each status was captured honestly (see `phase22-s10\summary.txt`).
5. **Parallel-run degradation incident (2026-10-26, this session):** a full-suite re-run launched *without* `--maxWorkers=1` (vitest default = parallel forks on 4 cores) starved the loaded machine (1.4 GB RAM free; WSL VM, Chrome, VS Code, Defender resident). Symptoms, all load-induced: 6 tests hit their caps (bcrypt hashing took 27 s vs sub-second; extraction tests at the 60 s cap; one 5 s IDOR test timed out), and one forks runner failed to start (`Timeout starting forks runner` → `src/lib/a11y.test.tsx` never collected, hence 995 = 1003 − 8). Every affected file passed in isolation: `37/39` in the 4-file rerun (only the starved-file `Axe is already running` race remained — an axe-core singleton collision created when an earlier test's `axe.run()` outlived its timeout), then `8/8` for `a11y.test.tsx` alone in 28 s. The **serial `--maxWorkers=1` re-run on the final state finished 1003/1003, exit 0**. Root cause = parallel configuration on this machine, not any test or code change; serial remains mandatory here.

## Protocol / validator coverage (non-vitest gates)

- OAI-PMH: error matrix live-verified (badVerb/badArgument/unknown-param/XSS → correct OAI errors, 200 + XML); `OAI_ENABLED` off/on covered by route tests.
- SRU: malformed CQL + SQLi probe → 400 at parse level; `operation=zebra` → 400 diagnostic 1/1.
- Citation exports (BibTeX/RIS), signposting, OpenURL, COAR Notify: suites green in regression batch.

## Verification result

All gates green; suite baseline **797 → 1003** with zero regressions (no failures, no skips, no timeouts in the final run).
