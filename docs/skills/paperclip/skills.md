# Paperclip Deployment Skill

Use this note when removing or rebuilding Paperclip on a Coolify VPS.

## What To Capture Before Removal

- Coolify resource name.
- Git/image source.
- Domains and proxy routes.
- Environment variables.
- Database name and credentials.
- Docker volumes and mount paths.
- Uploaded files/storage path.
- Any webhook URLs or integrations.

## Safe Removal Steps

1. Confirm no active production app depends on Paperclip.
2. Export environment variables from Coolify.
3. Back up the database if one exists.
4. Back up Docker volumes and mounted upload directories.
5. Stop the Paperclip resource in Coolify.
6. Wait and check server logs for dependency errors from other apps.
7. Delete the Paperclip resource in Coolify.
8. Remove unused domains/proxy routes.
9. Remove only confirmed-unused Docker volumes.
10. Prune unused images/build cache after confirming other apps are healthy.

## Rebuild Checklist

1. Create a new Coolify resource.
2. Reconnect Git/image source.
3. Restore environment variables.
4. Restore database and volume data.
5. Attach domain and SSL.
6. Run login/upload/download smoke tests.
7. Confirm backups are configured.

## Mistakes To Avoid

- Do not delete volumes before a verified backup exists.
- Do not prune all Docker resources blindly on a shared VPS.
- Do not assume a Coolify app delete removes every persistent dependency.
- Do not leave stale domains pointing to deleted services.
