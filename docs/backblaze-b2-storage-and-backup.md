# Backblaze B2 Storage And Backup

## Architecture

Backblaze B2 is the long-term object store for the Smart Library multi-server deployment.

- Coolify control server manages infrastructure.
- App server runs the Next.js app and worker.
- Supabase server runs self-hosted Supabase.
- B2 stores large/long-term files, exports, repository objects, and backups.
- Supabase Storage can remain for compatibility and small assets.

## Environment Variables

Server-only variables:

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

Never expose these as `NEXT_PUBLIC_*` variables.

## Object Key Structure

```text
tenants/{tenant_id}/repository/{year}/{record_id}/{filename}
tenants/{tenant_id}/catalogue/{resource_id}/{filename}
tenants/{tenant_id}/exports/{date}/{filename}
backups/supabase/{date}/{filename}
backups/app/{date}/{filename}
```

The server helpers in `src/server/storage/b2Client.ts` generate these paths.

## Metadata Table

Migration:

- `supabase/migrations/20260626103000_library_objects_b2.sql`

Table:

- `library_objects`

Metadata includes tenant, bucket, object key, original filename, content type, size, checksum, visibility, linked entity, uploader, and creation timestamp.

## API Routes

- `POST /api/admin/storage/b2/signed-upload`
- `POST /api/admin/storage/b2/signed-download`
- `GET /api/admin/storage/b2/objects`

Signed uploads and downloads require Supabase bearer auth. Upload creation requires librarian/admin roles. Download access checks tenant ownership and visibility.

## Visibility

- `private`: uploader or admin/librarian only.
- `tenant`: authenticated tenant users can read metadata; file access still uses signed URLs.
- `public`: intended public metadata. Use public object URLs only for intentionally public objects.

## Legal And Copyright Rule

Do not store illegal or copyrighted files unless the institution has explicit rights. Prefer storing:

- repository files with rights/approval
- legal open-access files
- generated reports and exports
- backups
- catalogue-related assets owned/licensed by the library

## Backup Plan

### Supabase Postgres Backups

- Run scheduled `pg_dump` or Supabase-compatible backup jobs from the worker/server.
- Upload backups to `B2_BUCKET_BACKUPS` with keys like `backups/supabase/{date}/{filename}`.
- Encrypt backup archives before upload where possible.
- Store restore instructions and credentials outside the server in a password manager.

### App Env And Config Backups

- Export Coolify app environment variables periodically.
- Store encrypted config backups at `backups/app/{date}/{filename}`.
- Do not commit secrets to Git.

### Edge Functions

- Supabase Edge Function source is backed by Git under `supabase/functions`.
- Deployment artifacts do not need separate B2 backup if Git is current.

### Retention

- Daily backups: keep 14 days.
- Weekly backups: keep 8 weeks.
- Monthly backups: keep 12 months.
- Annual archive: optional, based on institution policy.

### Monthly Restore Test

- Download the latest monthly backup from B2.
- Restore into a disposable Supabase/Postgres environment.
- Verify migrations, auth-dependent tables, RLS-critical tables, and sample repository metadata.
- Record restore test result in worker logs or `scheduled_job_runs`.

### Emergency Restore Process

1. Freeze writes if corruption or compromise is suspected.
2. Provision replacement Supabase server through Coolify.
3. Restore latest verified database backup.
4. Reapply missing migrations if needed.
5. Reconfigure app server Supabase env vars.
6. Verify auth, RLS, catalogue, repository, and storage object links.
7. Re-enable public traffic.

## Worker Integration

The Smart Library worker can use `src/server/storage/b2Client.ts` to:

- upload harvested legal files
- write exports to B2
- upload encrypted Supabase/app backups
- write backup/restore logs to `scheduled_job_runs`

## Tests

The B2 client has mocked S3 tests for key generation and command dispatch.
