# Docker Deployment Audit

## Project Facts

- Next.js version: `14.2.35`.
- Package manager: npm with `package-lock.json`.
- Build command: `npm run build`.
- Start command: `npm run start` for non-standalone, `node server.js` in the standalone Docker image.
- Dev command: `npm run dev`.
- Worker command: `npm run worker`.
- Next.js standalone output: configured with `output: 'standalone'` in `next.config.mjs`.

## Environment Variables

Browser-visible variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Server-only variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_JWT_SECRET`
- `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `AI_DEFAULT_MODEL`, `AI_FAST_MODEL`, `AI_REASONING_MODEL`
- `B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_LIBRARY_FILES`, `B2_BUCKET_BACKUPS`, `B2_BUCKET_EXPORTS`
- `RESEND_API_KEY`, `CORE_API_KEY`, `NCBI_API_KEY`, `GOOGLE_BOOKS_KEY`, `SEMANTIC_SCHOLAR_KEY`, `ZENODO_TOKEN`
- `ARCJET_KEY`, `ARC_JET`, `CORS_ALLOWED_ORIGINS`, rate-limit variables
- Worker variables: `WORKER_ID`, `WORKER_CONCURRENCY`, `WORKER_POLL_INTERVAL_MS`, `WORKER_LOCK_TIMEOUT_MINUTES`, `WORKER_HEALTH_PORT`

## Supabase Client Files

- Browser/client wrapper: `src/lib/supabase.ts`.
- Generated/integration client path: `src/integrations/supabase/client*`.
- Server admin client: `src/server/supabase/adminClient.ts` uses `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Server user-scoped client: `src/server/supabase/userClient.ts` uses anon/publishable key with a user bearer token.

## API Routes And Server Runtime

The project uses App Router API routes under `app/api/**/route.ts`, including admin approvals, catalogue import/staging, barcode lookup, B2 signed URL routes, harvest/resource discovery, and health routes.

New health routes:

- `/api/health`
- `/api/health/supabase`

## Existing Docker State Before This Pass

- Existing `Dockerfile` already used Next standalone output. It now uses Node 22 Alpine to match dependency engine requirements.
- Existing `Dockerfile.worker` existed for worker runtime.
- Existing `docker-compose.yml` previously started a local PostgreSQL service. That conflicted with the hosted Supabase/current production requirement and was replaced with an app-only production compose entry.

## Deployment Risks

- `NEXT_PUBLIC_*` variables are browser-visible and must be supplied at Docker build time for client bundles.
- `SUPABASE_SERVICE_ROLE_KEY`, B2 keys, AI keys, and email keys must be runtime-only and must not be passed as Docker build args.
- Production compose intentionally does not run Supabase Local or PostgreSQL. Supabase backend switching is done by env values only.
- If Coolify builds without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, browser-side Supabase calls may be built with empty values.
- Health checks intentionally report only reachability/status and do not return secrets.
