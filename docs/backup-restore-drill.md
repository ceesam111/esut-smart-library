# Backup Restore Drill

Purpose: prove that Smart Library can recover from database loss, object storage loss, app server loss, or migration failure.

## Scope

- Supabase PostgreSQL database.
- Supabase Auth metadata where export/restore is supported.
- Supabase Storage or B2 object metadata.
- Backblaze B2 buckets for library files, backups, and exports.
- App and worker deployment configuration.

## RPO And RTO Targets

- Initial RPO target: 24 hours for database, 24 hours for B2 metadata, immediate for Git-managed app code.
- Initial RTO target: 4 hours for app restoration, 8 hours for full database/object verification.
- Tighten these after first production semester load testing.

## Backup Inputs

- Database dump from hosted or self-hosted Supabase.
- Migration files from Git.
- B2 bucket inventory and object copies.
- Coolify environment variable export stored securely outside Git.
- Supabase secrets inventory stored in a password manager.

## Drill Frequency

- Before production launch.
- Monthly for the first three months.
- Quarterly after stable operations.
- After major schema, auth, or storage architecture changes.

## Drill Steps

1. Create a clean staging Supabase project or self-hosted Supabase instance.
2. Restore latest database dump.
3. Apply any migrations that are newer than the dump.
4. Restore or point staging to a copy of B2 objects.
5. Configure staging app and worker env vars to restored Supabase and B2 staging buckets.
6. Start app and worker containers.
7. Run smoke tests:
   - Login as admin.
   - Login as patron.
   - Search catalogue.
   - Open repository item metadata.
   - Request signed B2 download for authorized object.
   - Run `system.healthCheck` worker job.
   - Approve/reject a test staging item.
8. Validate counts:
   - `patrons`
   - `catalogue_items`
   - `repository_items`
   - `resource_candidates`
   - `library_objects`
   - `agent_jobs`
9. Validate RLS:
   - Tenant A cannot read Tenant B rows.
   - Patron cannot read pending candidates or admin logs.
10. Record results, timestamps, dump ID, B2 snapshot/inventory ID, and failures.

## Success Criteria

- Staging app boots against restored database.
- Authenticated users can log in.
- RLS tests pass.
- B2 signed URL flow works for restored objects.
- Worker can claim and complete a test job.
- No production services are modified during drill.
- RPO/RTO targets are met or gaps are documented.

## Failure Handling

- If database restore fails, preserve logs and verify dump integrity/checksum.
- If B2 object restore fails, compare object inventory with `library_objects` metadata.
- If migrations fail, stop and create a migration compatibility issue before production.
- If RLS fails, mark production launch blocked.

## Evidence Template

- Drill date:
- Operator:
- Source environment:
- Target staging environment:
- Database dump ID/checksum:
- B2 bucket/inventory ID:
- Start time:
- End time:
- RPO achieved:
- RTO achieved:
- Smoke tests passed:
- RLS tests passed:
- Issues found:
- Fix owner:
- Sign-off:
