# Pre-Repair Baseline — ESUT Smart Library

Recorded: 2026-09-29 · Session: REPAIR SESSION 1

## 1. Git HEAD

```
4126748eefbd6beaa0b4bf090c95e7d720d462f0
```

## 2. Migration State

- **55 timestamped SQL files** in `supabase/migrations/`
- Range: `20260620202651_f5c5362c…` → `20260928070000_directory_databases.sql`
- Applied manually/ad-hoc to hosted Supabase (no `db push` script)
- `docker/postgres/init-migrations.sh` orphaned (not used)
- No migration tracking table in DB (no `supabase_migrations.schema_migrations`)

## 3. Database Schema Version

- Hosted DB: `rnnjspkdhojoigncdgmy` (Supabase pooler)
- **125 tables**, **125 RLS-enabled**, **0 tables without RLS**, **0 policy-less RLS tables**
- **327 indexes** total
- Hot-table index gaps: `circulation_transactions`=1, `reservations`=1, `fines`=1, `payments`=1
- 7 circulation FK columns lack covering indexes
- Production data: 12 catalogue items, 2 patrons, 0 loans, 0 repository items, 0 IR items

## 4. Container / Image Versions

| Container | Image | Status |
|---|---|---|
| `esut-app-new` | `ghcr.io/ceesam111/esut-smart-library:deploy-latest` | Up 20h (healthy) |
| `esut-worker` | `ghcr.io/ceesam111/esut-smart-library:worker-latest` | Up 2 days (no healthcheck) |

## 5. Environment Variable Names (values never recorded)

**Production (.env):**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME`, `RESEND_FROM_EMAIL`, `CORE_API_KEY`, `NCBI_API_KEY`, `GOOGLE_BOOKS_KEY`, `SEMANTIC_SCHOLAR_KEY`, `ZENODO_TOKEN`, `DISCOURSE_URL`, `DISCOURSE_SECRET`, `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `AI_DEFAULT_MODEL`, `AI_FAST_MODEL`, `AI_REASONING_MODEL`, `AI_MAX_TOKENS_DEFAULT`, `AI_TEMPERATURE_DEFAULT`, `WORKER_ID`, `WORKER_CONCURRENCY`, `WORKER_POLL_INTERVAL_MS`, `WORKER_LOCK_TIMEOUT_MINUTES`, `WORKER_HEALTH_PORT`, `ARCJET_KEY`, `ARC_JET`, `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_SENSITIVE_MAX`, `RATE_LIMIT_SENSITIVE_WINDOW_MS`, `APP_BASE_URL`, `NEXT_PUBLIC_APP_BASE_URL`, `NODE_ENV`

**Local (.env.local) additionally:** `GEMINI_API_KEY`, `GROQ_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_LYRIA_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `CLOUDFLARE_SITE_KEY`, `CLOUDFLARE_SECRET_KEY`, `GMAIL_SMTP_APP_PASSWORD`, `GMAIL_SMTP_USER`

## 6. TypeScript Error Count

```
tsc --noEmit → 64 total errors
```

All 64 in legacy `src/app-pages/` and `src/components/` directories. Root cause: `as const` pattern in `src/config/institution.config.ts` causing TypeScript to narrow union types to `never` when comparing `'single'` vs `'multi'` string literals. ~63 errors from this one pattern; 1 cosmetic (`ringColor` CSS property in `Team.tsx`).

**0 errors in new-wave code** (`src/server/`, `app/api/`, `worker/`).

Build passes only because `next.config.mjs` sets `typescript: { ignoreBuildErrors: true }`.

## 7. npm Audit Result

```
22 vulnerabilities (3 low, 10 moderate, 8 high, 1 critical)
```

| Severity | Count | Key packages |
|---|---|---|
| Critical | 1 | Next.js (image-optimizer DoS / RSC deserialization / request smuggling) |
| High | 8 | Nodemailer (2), sharp/libvips (2), DOMPurify, arcjet chain, others |
| Moderate | 10 | various |
| Low | 3 | various |

## 8. Vitest Test Discovery

```
Test Files: 43 passed (43)
Tests:      141 passed (141)
Duration:   79.37s
```

## 9. Excluded Test Patterns

`vitest.config.ts` include: `['src/**/*.test.ts', 'worker/**/*.test.ts']`

**6 route test files NEVER RUN** (excluded by config):
- `app/api/authorities/route.test.ts`
- `app/api/circulation/offline-sync/route.test.ts`
- `app/api/licenses/route.test.ts`
- `app/api/oai/route.test.ts`
- `app/api/orcid/route.test.ts`
- `app/api/sru/route.test.ts`

## 10. Health-Check State

- `esut-app-new`: Docker healthcheck **healthy**
- `esut-worker`: no healthcheck configured
- Live `https://virtuallibrary.esut.edu.ng/api/health` → 200

## 11. Object Storage Bucket Privacy

| Bucket | Public | Risk |
|---|---|---|
| `repository` | **true** | Restricted/embargoed files leak via direct URL |
| `theses` | **true** | Same |
| `aip-exports` | **true** | AIP exports publicly accessible |

All three buckets are **public**. Any file uploaded is immediately accessible via permanent public URL. No signed-URL or application-streamed access control exists.

## Rollback Instructions

### Code rollback
```bash
git revert <commit-hash>  # for each repair commit
# or
git reset --hard 4126748  # full rollback to pre-repair state
```

### Database rollback
- Migrations are additive (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN)
- No destructive migrations in repair plan
- If rollback needed: `DROP TABLE IF EXISTS <table>` for any new tables
- Index rollback: `DROP INDEX IF EXISTS <index_name>`

### Container rollback
```bash
# On VPS:
docker pull ghcr.io/ceesam111/esut-smart-library:deploy-latest
docker stop esut-app-new && docker rm esut-app-new
docker run -d --name esut-app-new ... ghcr.io/ceesam111/esut-smart-library:deploy-latest
```

### Dependency rollback
```bash
git checkout 4126748 -- package.json package-lock.json
npm ci
```

### Storage bucket privacy rollback
- Bucket privacy is set in Supabase Dashboard → Storage → Buckets → [bucket] → Public
- To rollback: toggle back to public
- Signed-URL code rollback: `git revert <commit>`
