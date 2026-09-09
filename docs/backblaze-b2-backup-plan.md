# Backblaze B2 Backup Plan

See `docs/backblaze-b2-storage-and-backup.md` for the full storage and backup plan.

Minimum production backup requirements:

- Supabase Postgres backups uploaded to `backups/supabase/{date}/`.
- App/Coolify env/config backups uploaded encrypted to `backups/app/{date}/`.
- Monthly restore test.
- 14 daily, 8 weekly, and 12 monthly retention baseline.
- Emergency restore runbook tested before production launch.
