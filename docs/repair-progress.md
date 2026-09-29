# Repair Progress — ESUT Smart Library

Session: REPAIR SESSION 1 · Started: 2026-09-29

## Task Log

### BATCH 0 — Baseline and Rollback

| # | Task | Original Problem | Root Cause | Files Changed | Migration | Tests Added | Runtime Verification | Security Impact | Status | Remaining Limitation |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.1 | Record Git HEAD | — | — | — | — | — | `4126748` confirmed | — | COMPLETE | — |
| 0.2 | Record migration state | — | — | — | 55 SQL files, manual apply | — | — | — | COMPLETE | No migration tracking table |
| 0.3 | Record DB schema version | — | — | — | — | — | 125 tables, 125 RLS, 327 indexes | — | COMPLETE | — |
| 0.4 | Record container/image versions | — | — | — | — | — | esut-app-new healthy, esut-worker up | — | COMPLETE | Worker has no healthcheck |
| 0.5 | Record env var names | — | — | — | — | — | Names only, no values | — | COMPLETE | — |
| 0.6 | Record TypeScript errors | — | — | — | — | — | 64 total (all legacy) | — | COMPLETE | — |
| 0.7 | Record npm audit | — | — | — | — | — | 22 vulns (1C/8H/10M/3L) | — | COMPLETE | — |
| 0.8 | Record Vitest discovery | — | — | — | — | — | 141 passed / 43 files | — | COMPLETE | — |
| 0.9 | Record excluded test patterns | — | — | — | — | — | 6 app/**/route.test.ts excluded | — | COMPLETE | — |
| 0.10 | Record health-check state | — | — | — | — | — | esut-app-new healthy | — | COMPLETE | — |
| 0.11 | Record storage bucket privacy | — | — | — | — | — | All 3 buckets public=true | — | COMPLETE | — |
| 0.12 | Write pre-repair-baseline.md | — | — | `docs/pre-repair-baseline.md` | — | — | — | — | COMPLETE | — |

### BATCH 1 — Security P0

| # | Task | Original Problem | Root Cause | Files Changed | Migration | Tests Added | Runtime Verification | Security Impact | Status | Remaining Limitation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Next.js critical CVE | 1 critical npm vuln | Next.js 14.2.35 has known CVEs | `package.json` | — | — | `npm audit --omit=dev` → 13 vulns (0 crit, 1 high, 9 mod, 3 low) | Critical eliminated; high reduced from 8 to 1 | COMPLETE | js-yaml transitive dep remains (major upgrade risk) |
| 1.2 | COAR Notify security | Anonymous POST = 201 | No auth, no validation, no rate limiting | `app/api/coar-notify/inbox/route.ts`, `src/server/interoperability/coar-security.ts` (new), `src/server/interoperability/coar-security.test.ts` (new) | — | 23 tests (coar-security.test.ts) | All 23 COAR security tests pass; signature verification, rate limiting, replay protection, SSRF protection all verified | Anonymous POST now returns 401; signature required; rate limiting; replay protection; SSRF protection | COMPLETE | Shared secret must be ≥32 chars (COAR_NOTIFY_SHARED_SECRET env var) |
| 1.3 | SIP2 authentication | Any non-blank password accepted | `authenticate()` checks `password !== ''` only | `src/server/sip2/auth.ts` (new), `src/server/sip2/server.ts`, `src/server/sip2/auth.test.ts` (new), `src/server/sip2/sip2.test.ts` | `20260929010000_sip2_terminals.sql` | 11 tests (auth.test.ts) + 4 tests (sip2.test.ts) | All 15 SIP2 tests pass; credential validation, rate limiting, operation permissions all verified | Real credential validation with SHA-256 hashing; rate limiting; account lockout; operation-level permissions; audit logging | COMPLETE | No TCP listener yet — AUTHENTICATION HARDENED, not PRODUCTION SIP2 COMPLETE |
| 1.4 | Object storage/embargo | Public buckets expose all files | Buckets created with public=true, no signed URLs | `supabase/migrations/20260929020000_storage_private_buckets.sql`, `src/server/storage/secureDownload.ts` (new), `app/api/repository/download/route.ts` (new), `app/api/repository/route.ts`, `src/server/storage/secureDownload.test.ts` (new) | `20260929020000_storage_private_buckets.sql` | 10 tests (secureDownload.test.ts) | All 10 storage security tests pass; access control, embargo enforcement, SSRF protection verified | Buckets now private; file_url removed from API; secure download route with auth+embargo; signed URLs only after authorization | COMPLETE | B2 buckets still public (separate from Supabase Storage); file_url column still exists but not exposed via API |

### BATCH 2 — TypeScript, Lint, Tests, CI

| # | Task | Original Problem | Root Cause | Files Changed | Migration | Tests Added | Runtime Verification | Security Impact | Status | Remaining Limitation |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Remove ignoreBuildErrors | Build passes despite 64 TS errors | `next.config.mjs` has `typescript: { ignoreBuildErrors: true }` | — | — | — | — | — | PENDING | — |
| 2.2 | Fix all 64 TypeScript errors | 64 errors in legacy code | `as const` pattern causing `never` narrowing | — | — | — | — | — | PENDING | — |
| 2.3 | Lint config + fix | No working ESLint config | Pre-existing, no config file | — | — | — | — | — | PENDING | — |
| 2.4 | Vitest discovery | 6 route tests excluded | `vitest.config.ts` include misses `app/**` | — | — | — | — | — | PENDING | — |
| 2.5 | CI gates | No test/tsc/lint in CI | CI only does Docker build | — | — | — | — | — | PENDING | — |

### BATCH 3 — Database Correctness

| # | Task | Original Problem | Root Cause | Files Changed | Migration | Tests Added | Runtime Verification | Security Impact | Status | Remaining Limitation |
|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | Report writer serials column | Serials report queries nonexistent `end_date` | Schema drift or wrong column name | — | — | — | — | — | PENDING | — |
| 3.2 | Circulation indexes | 7 FK columns uncovered | Missing indexes on hot tables | — | — | — | — | — | PENDING | — |
| 3.3 | DB integrity review | — | — | — | — | — | — | — | PENDING | — |
| 3.4 | Migration validation | — | — | — | — | — | — | — | PENDING | — |

### BATCH 4 — Broken Core Services

| # | Task | Original Problem | Root Cause | Files Changed | Migration | Tests Added | Runtime Verification | Security Impact | Status | Remaining Limitation |
|---|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Federated search | Production search broken (#4) | Unknown — under investigation | — | — | — | — | — | PENDING | — |
| 4.2 | Workers/agents | All workers failing (#19) | Unknown — under investigation | — | — | — | — | — | PENDING | — |
| 4.3a | Owner issue #3 | ILL submit broken | Direct supabase insert, no API route | — | — | — | — | — | PENDING | — |
| 4.3b | Owner issue #13 | Hold checkout broken | Unknown | — | — | — | — | — | PENDING | — |
| 4.3c | Owner issue #14 | Barcode scanning broken | Unknown | — | — | — | — | — | PENDING | — |
| 4.3d | Owner issue #19 | AI agent workers failing | Unknown | — | — | — | — | — | PENDING | — |

### KBART Hotfix

| # | Task | Original Problem | Root Cause | Files Changed | Migration | Tests Added | Runtime Verification | Security Impact | Status | Remaining Limitation |
|---|---|---|---|---|---|---|---|---|---|---|
| K.1 | KBART 500 | Route always returns 500 | `requireRole(new Request('http://localhost'))` synthetic request | — | — | — | — | — | PENDING | — |

### BATCH 2 — TypeScript, Lint, Tests, CI

| # | Task | Original Problem | Root Cause | Files Changed | Migration | Tests Added | Runtime Verification | Security Impact | Status | Remaining Limitation |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Capture TS baseline | — | — | — | — | — | 65 errors captured | — | COMPLETE | — |
| 2.2 | Remove TS suppression | `ignoreBuildErrors:true` | Build passed despite errors | `next.config.mjs` | — | — | Removed permanently | — | COMPLETE | — |
| 2.3 | Fix all TS errors | 65 errors | 4 root causes (as const, empty arrays, ringColor, request.ip) | `src/config/institution.config.ts`, `src/app-pages/Team.tsx`, `middleware.ts` | — | — | **TSC = 0 errors** | — | COMPLETE | — |
| 2.4 | Establish lint | No ESLint config | Missing config | `eslint.config.mjs` (new) | — | — | Lint runs with 0 errors | — | COMPLETE | Full lint slow on large codebase |
| 2.5 | Fix Vitest discovery | 6 route tests excluded | `vitest.config.ts` include missed `app/**` | `vitest.config.ts` | — | — | 52 test files discovered (was 46) | — | COMPLETE | — |
| 2.6 | Run all tests | — | — | — | — | — | **206 passed (52 files)** | — | COMPLETE | — |
| 2.7 | Test discovery regression | — | — | — | — | — | CI includes vitest run | — | COMPLETE | — |
| 2.8 | Establish CI | No quality gates | CI only did Docker build | `.github/workflows/ci.yml` (new) | — | — | tsc + lint + vitest + build + audit | — | COMPLETE | — |
| 2.9 | Build validation | — | — | — | — | — | **Build exit 0** | — | COMPLETE | — |
| 2.10 | Script cleanup | Missing typecheck/lint scripts | — | `package.json` | — | — | `npm run typecheck`, `npm run lint` work | — | COMPLETE | — |
| 2.11 | Quality gates doc | — | — | `docs/quality-gates.md` (new) | — | — | — | — | COMPLETE | — |
| 2.12 | Update repair progress | — | — | `docs/repair-progress.md` | — | — | — | — | COMPLETE | — |
