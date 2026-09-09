# Digital Wealth Creators Coolify Migration Runbook

Purpose: move ESUT Smart Library, IBUSINESS, and OURSCHOOL from the expiring VibeCloud Coolify VPS to the Digital Wealth Creators Coolify VPS with minimum downtime and without losing secrets, volumes, databases, or deployment history.

## Security Decision

Do not deploy IBUSINESS or OURSCHOOL into a Coolify instance where another person remains root/admin if those apps must be private from that person.

Reason: Coolify root/admin UI access can expose resources, deployments, environment variables, logs, domains, Git sources, containers, and sometimes terminal/exec features. Lack of terminal knowledge is not a security control.

Acceptable private options:

1. Use a separate VPS and separate Coolify instance controlled only by you.
2. Remove or demote the partner's Coolify root/admin account before adding IBUSINESS/OURSCHOOL.
3. Keep IBUSINESS/OURSCHOOL outside Coolify and manage them manually on a private server only you can access.

Do not rely on hidden project names, private Git repositories, or Docker labels to hide apps from a Coolify root/admin.

## Target Layout

Recommended layout for Digital Wealth Creators:

- ESUT Smart Library: may be deployed in shared Coolify if visibility is acceptable.
- IBUSINESS: deploy only in a private Coolify/server if partner must not see it.
- OURSCHOOL: deploy only in a private Coolify/server if partner must not see it.
- Paperclip: remove if unused.
- Open WebUI: remove if unused.

## Required Access Before Execution

Collect these before touching production:

- VibeCloud Coolify URL and admin login.
- Digital Wealth Creators Coolify URL and admin login.
- SSH/root access or provider console access for both VPSs.
- GitHub repository URLs and deployment branches for ESUT, IBUSINESS, and OURSCHOOL.
- Domain registrar/DNS access.
- Current Coolify environment variables export for each app.
- Database locations and credentials for each app.
- Volume/storage inventory for each app.
- Backup destination credentials, preferably Backblaze B2 or equivalent.

## Pre-Migration Inventory

For each source app, record:

- App name in Coolify.
- Git repository and branch.
- Build pack or Dockerfile/compose file.
- Domain names and SSL status.
- Environment variables, redacted in written notes.
- Database type and location.
- Volumes and mounted paths.
- Object storage buckets.
- Cron jobs/workers/queues.
- Webhook URLs.
- Health check path.
- Current image/container names.

## Remove Paperclip And Open WebUI Safely

Only remove after confirming they are not used by ESUT, IBUSINESS, OURSCHOOL, or another active service.

1. Export environment variables for Paperclip and Open WebUI.
2. Record domain names, image names, volumes, compose files, and database dependencies.
3. Take a final backup of their persistent volumes and databases.
4. Stop the services in Coolify.
5. Confirm no other apps depend on their Docker networks, databases, or volumes.
6. Delete the Coolify resources.
7. Delete unused Docker volumes only after backup verification.
8. Remove unused domains and proxy routes.
9. Run `docker system df` on the server and prune only unused images/build cache.
10. Reboot only if memory is still not released and downtime is acceptable.

## ESUT Smart Library Migration

ESUT currently has repository deployment assets:

- `Dockerfile`
- `Dockerfile.worker`
- `docker-compose.prod.yml`
- `docs/coolify-deployment.md`
- `docs/cutover-runbook.md`
- `docs/backup-restore-drill.md`

Deployment steps:

1. In Digital Wealth Creators Coolify, create a new app from GitHub repository `ceesam111/esutlibrary`.
2. Select branch `nextjs-vercel-migration` unless production has changed.
3. Use Docker Compose deployment with `docker-compose.prod.yml` if deploying app and worker together.
4. Configure build args:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_APP_BASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Configure runtime env vars for the app:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_APP_BASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `FROM_EMAIL` or `RESEND_FROM_EMAIL`
   - `FROM_NAME`
   - `RESEND_SMTP_HOST=smtp.resend.com`
   - `RESEND_SMTP_PORT=587`
   - `RESEND_SMTP_USER=resend`
   - AI, B2, Turnstile, ElevenLabs, and worker variables as applicable.
6. Deploy to a staging domain first.
7. Verify `/api/health`.
8. Verify `/api/health/supabase`.
9. Register a test patron and confirm verification email is accepted by Resend SMTP.
10. Verify login and dashboard access.
11. Verify catalogue and repository routes.
12. Switch DNS only after smoke tests pass.

## IBUSINESS And OURSCHOOL Migration

Do not deploy these into shared Coolify if the partner must not see them.

For each private app:

1. Create a private Coolify/server controlled only by you.
2. Import the app from its Git repository.
3. Recreate environment variables from source Coolify export.
4. Restore or connect the database.
5. Restore volumes/object storage.
6. Deploy on a temporary staging domain.
7. Run smoke tests.
8. Lower DNS TTL to 300 seconds before cutover.
9. Switch DNS.
10. Monitor logs for at least 2 hours.

## DNS Cutover

1. Lower TTL before migration.
2. Deploy and test on staging subdomains.
3. Pause write-heavy features if the app has local database writes.
4. Take final database and volume backups.
5. Switch DNS `A`/`CNAME` records to Digital Wealth Creators.
6. Enable SSL in Coolify.
7. Confirm HTTPS and health checks.
8. Keep VibeCloud online until traffic and logs are stable.

## Validation Checklist

- App containers running.
- Health checks green.
- Domains resolve to new VPS.
- HTTPS certificates valid.
- Login works.
- Email sending works.
- Database read/write works.
- File uploads/downloads work.
- Background workers running.
- Logs do not show repeated errors.
- Old server still available for rollback until sign-off.

## Rollback

Rollback if login, database writes, payments, email, or core dashboard flows fail.

1. Point DNS back to VibeCloud.
2. Stop workers on the failed target to prevent split writes.
3. Preserve target logs and failed container state.
4. Reconcile any writes made during the failed window.
5. Fix on staging before retrying.

## Information Still Needed

- Digital Wealth Creators Coolify URL.
- Whether partner account can be removed/demoted.
- IBUSINESS repository/deployment details.
- OURSCHOOL repository/deployment details.
- Current Paperclip/Open WebUI resource names and volumes.
- Whether ESUT should remain on hosted Supabase or move Supabase too.
