# Foundation Implementation

## Summary

This implementation adds a Supabase-compatible backend foundation for future catalogue CSV import, patron enrolment, barcode cataloguing, auto resource fetching, Backblaze B2 storage, Vercel AI Gateway calls, and worker jobs.

The current Supabase backend remains the source of truth. New code should use the server utility layer first so future self-hosted Supabase migration can replace hosted Supabase endpoints without rewriting UI flows.

## Migration

Added migration:

- `supabase/migrations/20260625142000_foundation_services.sql`

It creates:

- `approval_queue`
- `audit_logs`
- `agent_runs`
- `tenant_ai_usage`
- `scheduled_job_runs`

It also adds:

- `tenant_id` to `patrons` and `user_roles`
- default tenant helper `public.default_tenant_id()`
- tenant resolver helper `public.current_tenant_id()`
- role helpers `public.has_any_role`, `public.is_library_admin`, and `public.is_global_admin`
- RLS policies for tenant-scoped reads and admin-only access
- tenant/status/created/entity indexes required by the foundation

## Server Utilities

Added server-side modules:

- `src/server/tenant/resolveTenant.ts`
- `src/server/auth/requireUser.ts`
- `src/server/auth/requireRole.ts`
- `src/server/auth/permissions.ts`
- `src/server/audit/writeAuditLog.ts`
- `src/server/approvals/createApprovalItem.ts`
- `src/server/approvals/approveItem.ts`
- `src/server/approvals/rejectItem.ts`
- `src/server/ai/vercelAiGatewayClient.ts`
- `src/server/storage/b2Client.ts`
- `src/server/validation/commonSchemas.ts`
- `src/server/supabase/adminClient.ts`
- `src/server/supabase/userClient.ts`

Service-role access is isolated to server modules and route handlers. Do not import these modules into client components.

## Route Handlers

Added route handlers:

- `GET /api/admin/approvals`
- `POST /api/admin/approvals`
- `POST /api/admin/approvals/[id]/approve`
- `POST /api/admin/approvals/[id]/reject`
- `GET /api/admin/audit-logs`
- `POST /api/admin/patron-approvals/[id]/approve`
- `POST /api/admin/patron-approvals/[id]/reject`

Browser callers must pass the Supabase access token as `Authorization: Bearer <token>`.

## Admin UI

Updated:

- `src/app-pages/admin/Approvals.tsx`

The page now has tabs for:

- pending patron registrations
- foundation approval queue
- audit logs for super admins

Patron approve/reject and foundation approve/reject actions now call server route handlers instead of writing privileged changes directly from the browser.

## AI Gateway

Client:

- `src/server/ai/vercelAiGatewayClient.ts`

Environment variables:

```env
AI_GATEWAY_API_KEY=
AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1
AI_DEFAULT_MODEL=
AI_FAST_MODEL=
AI_REASONING_MODEL=
```

Behavior:

- OpenAI-compatible `/chat/completions` calls.
- Timeout support.
- Retry support.
- PII redaction for emails, phone numbers, and common patron identifiers before messages are sent.
- Every call creates/updates `agent_runs`.
- Every successful call writes `tenant_ai_usage`.

## Backblaze B2

Client:

- `src/server/storage/b2Client.ts`

Environment variables:

```env
B2_ENDPOINT=
B2_REGION=
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_LIBRARY_FILES=
B2_BUCKET_BACKUPS=
B2_BUCKET_EXPORTS=
B2_PUBLIC_BASE_URL=
```

Functions:

- `uploadObject`
- `getSignedUploadUrl`
- `getSignedDownloadUrl`
- `deleteObject`
- `objectExists`
- `listObjectsByPrefix`
- `copyObject`

B2 credentials must stay server-only. Do not expose them as `NEXT_PUBLIC_*` variables.

## Validation And Tests

Added:

- `vitest.config.ts`
- `src/server/auth/permissions.test.ts`
- `src/server/validation/commonSchemas.test.ts`

Test command:

```bash
npm run test
```

The tests cover:

- tenant-scoped row visibility helper
- role restrictions for approval queue items
- audit-log role restrictions
- patron PII redaction before AI calls

## Required Deployment Environment

Server-only variables:

```env
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=
AI_GATEWAY_API_KEY=
AI_GATEWAY_BASE_URL=
AI_DEFAULT_MODEL=
AI_FAST_MODEL=
AI_REASONING_MODEL=
B2_ENDPOINT=
B2_REGION=
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_LIBRARY_FILES=
B2_BUCKET_BACKUPS=
B2_BUCKET_EXPORTS=
B2_PUBLIC_BASE_URL=
```

Browser-safe variables remain:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Usage Pattern For New Features

1. Validate input with `src/server/validation/commonSchemas.ts` or feature-specific schemas.
2. Resolve the user through `requireUser` or `requireRole` in a route handler.
3. Resolve tenant through `resolveTenant`.
4. Create an approval item for human review if the action is risky.
5. Write audit logs through `writeAuditLog`.
6. Use `callVercelAiGateway` for AI work.
7. Use `b2Client` for object storage.
8. Log long-running worker activity in `agent_runs` or `scheduled_job_runs`.

## Remaining Work

- Apply the new migration to the live Supabase project.
- Set server-only env vars in Vercel/Coolify.
- Move catalogue import and patron import logic into feature services.
- Add signed upload APIs for B2-backed browser uploads.
- Move content harvest into a worker container after the job runner is introduced.
- Tighten older permissive RLS policies outside the new foundation tables.
