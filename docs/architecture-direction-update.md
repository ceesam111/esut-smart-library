# Architecture Direction Update

Generated: 2026-06-26

## What Changed

The production architecture is now Supabase-native across both the temporary hosted phase and the future self-hosted phase.

Previous planning allowed for a possible move from Supabase to plain PostgreSQL with a custom/auth replacement path. That direction is now superseded. The Smart Library app should remain compatible with Supabase Auth, Supabase Postgres, RLS, migrations, Edge Functions, and Supabase-style storage/function patterns.

The new target architecture is multi-server and Coolify-managed:

- Coolify control panel runs on its own server.
- The Next.js Smart Library app runs on a separate app server managed by Coolify.
- The Smart Library worker runs on the app server initially, or on a separate worker server later.
- Self-hosted Supabase runs on a separate Supabase server managed by Coolify.
- Backblaze B2 S3-compatible storage is used for backups, exports, repository files, and object storage.
- Vercel AI Gateway is used for controlled AI calls.
- Paperclip is not required.
- OpenClaw is not required for production.

## Current Development Phase

Keep using the existing hosted/free Supabase credentials already present in the project.

Feature development should continue against the current Supabase-compatible app. Self-hosted Supabase preparation must not block feature delivery.

## Previous Work That Remains Valid

The Prompt 3 catalogue CSV work remains valid because it is Supabase-compatible:

- `supabase/migrations/20260625152000_catalogue_csv_import.sql` uses Supabase SQL migrations and RLS.
- `catalogue_import_batches` and `catalogue_staging` preserve `tenant_id` and avoid direct live catalogue writes during upload.
- Server route handlers use Supabase bearer tokens for user identity and server-side Supabase service role only where privileged writes are required.
- Client code continues to use Supabase session tokens and does not expose `SUPABASE_SERVICE_ROLE_KEY`.
- Deterministic enrichment uses Open Library and Google Books, not a plain database migration assumption.
- Approval and audit flows use Supabase tables created by migrations.
- Tests are focused on validation, role checks, tenant-scoped visibility helpers, and PII redaction.

The shared foundation work also remains valid with one terminology correction:

- `src/server/supabase/adminClient.ts` and `src/server/supabase/userClient.ts` are Supabase-native and remain useful.
- `src/server/auth/*`, `src/server/tenant/*`, `src/server/audit/*`, `src/server/approvals/*`, and `src/server/catalogue/*` should continue using Supabase-compatible access patterns.
- `src/server/storage/b2Client.ts` remains valid because Backblaze B2 is still part of the agreed production target.
- `src/server/ai/vercelAiGatewayClient.ts` remains valid because Vercel AI Gateway is still part of the agreed production target.

## What Must Be Refactored Or Marked For Review

No implemented Prompt 3 code was found that directly uses Prisma, Auth.js, NextAuth, Drizzle, Kysely, or raw `pg` database access.

Documentation from the earlier audit/foundation phase contains superseded migration language and must be treated as historical guidance, not active direction:

- `docs/upgrade-readiness-audit.md` mentions future plain PostgreSQL tooling such as Prisma/Drizzle/Kysely/pg and Coolify PostgreSQL. That section is now superseded by self-hosted Supabase.
- `docs/foundation-implementation.md` previously described a future Coolify PostgreSQL migration. That wording should be interpreted as self-hosted Supabase migration instead.

Review marker:

- Any future `src/server/db/*` abstraction must be a Supabase-compatible adapter, not a Prisma-only or plain-Postgres-only rewrite.
- Any future auth work must keep Supabase Auth compatibility unless explicitly approved otherwise.
- Any future migration work must produce Supabase-compatible SQL/RLS/Edge Function changes.

## Prompt 3 Catalogue CSV Continuation

Prompt 3 should continue under the Supabase-compatible architecture.

The importer should continue using:

- Supabase migrations for `catalogue_import_batches`, `catalogue_staging`, indexes, and RLS.
- Supabase RLS to enforce tenant isolation.
- Next.js route handlers only for service-role operations such as staging imports, approval, rejection, audit writes, duplicate checks, and privileged catalogue writes.
- `supabase.from()` for normal client-side reads where RLS is sufficient.
- `supabase.rpc()` where database-side role or tenant helpers are appropriate.
- `supabase.functions.invoke()` or Supabase Edge Functions for workloads better deployed with Supabase, especially portable enrichment/worker-adjacent tasks.

The current catalogue CSV implementation remains aligned because upload parsing is client-side, while staging, enrichment, duplicate checks, approval, and audit writes go through server-controlled Supabase access.

## Future Self-Hosted Supabase Migration

The self-hosted migration should be an environment and infrastructure migration first, not an application rewrite.

The app should be able to switch from hosted Supabase to self-hosted Supabase by changing environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

Function/storage URLs may also need to change if the self-hosted Supabase deployment exposes different public endpoints.

Migration approach:

- Keep migrations in `supabase/migrations` as the source of schema/RLS truth.
- Keep Edge Functions in `supabase/functions` where Supabase function portability is useful.
- Apply existing migrations to the self-hosted Supabase project.
- Migrate auth users, public schema data, storage metadata, and storage objects using Supabase-compatible backup/export tooling.
- Configure the app server environment to point at the self-hosted Supabase URL and anon key.
- Configure server-only env vars on the app server for `SUPABASE_SERVICE_ROLE_KEY` and any function/JWT secrets.
- Keep Backblaze B2 for large object storage, backups, exports, and repository files as agreed.

## Risk List

- Some older docs still describe a plain PostgreSQL/Auth replacement direction; treat those sections as superseded.
- Existing app code still has many direct browser `supabase.from()` calls. That is acceptable when protected by RLS, but privileged writes should continue moving into route handlers or Edge Functions.
- The current catalogue CSV migration depends on foundation helpers such as `public.default_tenant_id()` and `public.current_tenant_id()` from `20260625142000_foundation_services.sql`; migration order matters.
- Self-hosted Supabase URLs, function URLs, storage URLs, and JWT settings must be validated before cutover.
- RLS quality remains critical. Supabase-native does not remove the need to tighten older permissive RLS policies.
- Service-role keys must remain server-only in Coolify environment configuration and must never be prefixed with `NEXT_PUBLIC_`.

## Next Files To Modify

- `docs/foundation-implementation.md`: replace old Coolify PostgreSQL wording with self-hosted Supabase wording.
- `docs/upgrade-readiness-audit.md`: add a superseded note for the plain PostgreSQL/Auth migration recommendations.
- `src/app-pages/admin/CatalogueImport.tsx`: continue UX refinement only within the Supabase-compatible flow.
- `src/app-pages/admin/CatalogueImportBatch.tsx`: improve row editing/drawer behavior while keeping approvals server-side.
- `src/app-pages/admin/CatalogueStaging.tsx`: improve filtering and batch links.
- `supabase/functions/enrich-catalogue`: deterministic enrichment now lives here for hosted/self-hosted Supabase portability.
- `supabase/migrations/`: continue all schema/RLS work here for hosted and self-hosted Supabase compatibility.

## Decision

Continue Prompt 3. The implemented catalogue CSV uploader remains Supabase-compatible and does not need to be discarded.
