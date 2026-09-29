# Database Baseline — ESUT Smart Library

Date: 2026-09-29 · Session: REPAIR SESSION 1 · BATCH 3

## Schema Counts

| Metric | Count |
|---|---|
| Tables | 125 |
| Views | 0 |
| Indexes | 327 |
| Foreign keys | 140 |
| RLS-enabled tables | 125 |
| RLS policies | 366 |
| Functions | 31 |
| Triggers | 28 |
| Duplicate indexes | 0 |

## Migration State

- 58 timestamped SQL files in `supabase/migrations/`
- Applied manually/ad-hoc to hosted Supabase
- No migration tracking table in DB

## Circulation Table Indexes (Before BATCH 3)

| Table | Indexes |
|---|---|
| circulation_transactions | pkey only |
| fines | pkey only |
| loans | pkey, idx_loans_due, idx_loans_patron, idx_loans_status |
| payments | pkey only |
| reservations | pkey only |

## Report Writer Bug

- **Root cause:** `reportWriter.ts` serials report referenced `end_date` column
- **Actual column:** `serials_subscriptions.renewal_date`
- **Fix:** Changed query to use `renewal_date`
