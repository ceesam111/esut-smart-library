# Seed Data Schema Audit

## Hosted Schema Status

The hosted Supabase database was checked with `information_schema` and Supabase REST. The required operational schema is present after applying the missing hosted migrations and refreshing PostgREST schema cache.

Public tables found include catalogue, copies, patrons, roles, librarians, circulation, reservations, repository, events, CMS/blog, announcements, notifications, approval queue, catalogue import/staging, resource harvest/discovery, agent jobs/runs, audit logs, shelves, reports, serials/acquisitions, and B2 metadata.

Key tables verified:

- `catalogue_items`, `catalogue_copies`, `library_shelves`
- `patrons`, `user_roles`, `librarians`
- `loans`, `loan_fines`, `reservations`, `circulation_transactions`
- `repository_communities`, `repository_collections`, `repository_items`, `theses`
- `events`, `event_registrations`, `calendar_events`
- `blog_posts`, `announcements`, `cms_pages`, `cms_banners`, `newsletter_issues`
- `notifications`, `user_notifications`
- `approval_queue`, `catalogue_import_batches`, `catalogue_staging`
- `resource_harvest_sources`, `resource_harvest_runs`, `resource_candidates`, `resource_discovery_logs`
- `agent_jobs`, `agent_runs`, `tenant_ai_usage`
- `audit_logs`, `report_snapshots`, `library_objects`

## Missing Expected Tables

- No dedicated `tenants` or `institutions` table exists. Seed tenancy uses deterministic tenant UUIDs already supported by `tenant_id` columns.
- No `patron_staging` table was found. Patron import scenarios are represented through `approval_queue` and deterministic fake patrons.
- No first-class feature flag table was found. Seed settings use `app_settings` where needed and are documented as optional.

## Required Fields And Constraints

- `patrons`: requires `patron_id`, `full_name`, `email`, `patron_category`, `status`; `tenant_id` exists and is seeded.
- `user_roles`: requires `user_id`, `role`; role enum includes `super_admin`, `librarian`, `faculty_librarian`, `student`, `researcher_lecturer`, `admin_staff`, `guest`.
- `catalogue_items`: requires `title`, `authors`, `format`, `total_copies`, `available_copies`, `visibility`, `tenant_id`, `status`; supports rich metadata and source tagging.
- `catalogue_copies`: requires `item_id`, `status`, `tenant_id`; supports barcode and shelf location.
- `loans`: requires `patron_id`, `catalogue_item_id`, `due_date`, `status`.
- `repository_items`: requires `title`, `authors`, `type`, `visibility`, `status`; repository community/collection FKs are optional but seeded.
- `events`: requires `title`, `event_type`, `start_at`, `end_at`, `status`, `category`, `registration_required`, `registrations_count`.
- `catalogue_staging`: requires `batch_id`, `uploaded_by`, `source`, `status`, `confidence`, `authors`, `subjects`, `copies`, `item_type`.
- `resource_candidates`: requires `tenant_id`, `source_name`, `discovery_source`, `status`, `confidence`, `authors`, `subjects`, `raw_metadata`.
- `approval_queue`: requires `tenant_id`, `content_type`, `action_type`, `risk_tier`, `status`, `payload`.

## Seed Strategy

- Use TypeScript Supabase service-role scripts for auth users, JSON fields, FK ordering, and idempotent cleanup.
- Use `supabase/seed.sql` only as a pointer because auth users and complex cross-table data require service-role API access.
- Seed ESUT and OGLB by default; DPL can be included with `--all-tenants` or `DPL`.
- Use deterministic tenant IDs, emails, patron IDs, barcodes, slugs, source names, and titles.
- Delete only deterministic demo rows before reinsert, never arbitrary production rows.
- Add `tenant_id` wherever the table supports it.
- Add `source_name='demo_seed'`, `payload.seed_tag`, `raw_metadata.seed_tag`, or deterministic titles/slugs where explicit `seed_tag` columns do not exist.

## Risks

- Some legacy tables lack `tenant_id`; reset uses deterministic fake identifiers for those.
- Supabase hosted PostgREST schema cache may need `notify pgrst, 'reload schema'` after migrations.
- Demo password is for development/staging only and must be changed for production users.
- Reset is intentionally blocked unless `SEED_ALLOW_RESET=I_UNDERSTAND_THIS_WILL_DELETE_DEMO_DATA_ONLY`.

## Files Created Or Updated

- `scripts/demo-seed-lib.ts`
- `scripts/seed-demo-data.ts`
- `scripts/reset-demo-data.ts`
- `scripts/verify-demo-seed.ts`
- `supabase/seed.sql`
- `docs/demo-seed-data.md`
- `docs/demo-seed-ui-test-checklist.md`

## Safe Run Commands

PowerShell development/demo seed:

```powershell
$env:SEED_TARGET="demo"
npm run seed:demo
npm run seed:demo:verify
```

Reset demo rows only:

```powershell
$env:SEED_TARGET="demo"
$env:SEED_ALLOW_RESET="I_UNDERSTAND_THIS_WILL_DELETE_DEMO_DATA_ONLY"
npm run seed:demo:reset
```

Dry run:

```powershell
npm run seed:demo:dry-run
```
