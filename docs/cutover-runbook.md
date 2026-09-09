# Cutover Runbook

Purpose: move from hosted Supabase development/production to self-hosted Supabase on a separate Supabase Server without application code changes.

## Preconditions

- Self-hosted Supabase Server provisioned and secured.
- Supabase Studio protected by HTTPS and admin authentication, preferably IP-restricted or VPN-only.
- Postgres not publicly exposed except temporarily to restricted admin IPs during migration.
- All migrations apply successfully to self-hosted staging.
- Edge Functions deployed to self-hosted Supabase.
- Supabase Auth SMTP configured.
- B2 backup and restore drill completed.
- App and worker are deployed through Coolify and can switch env vars.

## Cutover Variables

Change these for app and worker:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Rotate or update as needed:

- Supabase JWT secret-dependent keys.
- Edge Function secrets.
- Webhook URLs.
- CORS/site URL settings.

## Dry Run

1. Restore recent hosted Supabase dump into self-hosted staging.
2. Point staging app and worker to self-hosted staging env vars.
3. Run the full smoke suite from `docs/test-plan.md`.
4. Verify app, worker, Edge Functions, RLS, B2 signed URLs, and AI logging.
5. Record migration duration and issues.

## Production Cutover Steps

1. Announce maintenance window.
2. Put app into maintenance mode or pause write-heavy admin workflows.
3. Stop worker service to prevent background writes during snapshot.
4. Take final hosted Supabase backup/dump.
5. Restore dump to self-hosted Supabase production.
6. Apply migrations not included in dump.
7. Deploy Edge Functions and configure secrets.
8. Verify database counts and critical records.
9. Update app env vars in Coolify.
10. Update worker env vars in Coolify.
11. Redeploy app and worker.
12. Run production smoke tests:
    - Public home page.
    - Catalogue search.
    - Login.
    - Admin approval queue.
    - B2 signed URL.
    - AI Brain test with safe metadata.
    - Worker `system.healthCheck` job.
13. Re-enable worker service and admin workflows.
14. Monitor logs, queue depth, Supabase CPU/memory, and error rates for 2 hours.

## Rollback Plan

Rollback if authentication, RLS, core search, or write workflows fail and cannot be fixed within the maintenance window.

1. Stop worker.
2. Revert Coolify app and worker env vars to hosted Supabase.
3. Redeploy app and worker.
4. Confirm hosted Supabase still has latest safe state.
5. Reconcile any writes made during failed cutover manually from audit logs.
6. Publish incident/update to admins.

## Post-Cutover Tasks

- Rotate old hosted Supabase keys if no longer needed.
- Disable public access to migration-only Postgres ports.
- Confirm backups are running from self-hosted Supabase to B2.
- Run restore drill from the self-hosted production backup.
- Update architecture docs with final URLs and owners.

## Sign-Off

- Technical lead:
- Security reviewer:
- Library owner:
- Maintenance window start/end:
- Rollback deadline:
- Final status:
