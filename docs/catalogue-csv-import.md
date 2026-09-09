# Catalogue CSV Import

## Overview

The catalogue CSV importer lets librarians upload many books/resources at once, validate them, enrich ISBN rows with deterministic metadata APIs, and stage them for review. It does not write directly to the live catalogue during upload.

## Screens

- `/admin/catalogue/import`: upload CSV, map columns, preview rows, validate, and stage valid rows.
- `/admin/catalogue/import/[batchId]`: review one import batch, compare raw/enriched data, approve/reject rows, and bulk approve `clean_match` rows.
- `/admin/catalogue/staging`: review pending staged rows across batches.

## CSV Template

Columns:

```text
isbn,title,authors,publisher,year,edition,language,category,subjects,copies,shelf_location,item_type,source_url,notes
```

Rules:

- Each row requires either `isbn` or `title`.
- `authors` and `subjects` are comma-separated.
- `item_type` must be `book`, `journal`, `ebook`, or `database`.
- `shelf_location` must match `LIBRARY/FLOOR/BAY/SHELF`.
- `copies` must be a positive integer when supplied.
- `source_url` must be a valid URL when supplied.

## Server Flow

1. Client parses CSV with PapaParse.
2. Client auto-maps matching headers and lets the user fix mappings.
3. Client validates and previews rows.
4. Client sends normalized rows to `POST /api/admin/catalogue/import` with the Supabase bearer token.
5. Server revalidates all rows.
6. Server checks duplicate ISBNs against `catalogue_items` for the current tenant.
7. Server enriches ISBN rows by invoking the Supabase Edge Function `enrich-catalogue`, which uses Open Library first and Google Books fallback.
8. Server inserts valid rows into `catalogue_staging` and creates a `catalogue_import_batches` row.
9. Server creates an `approval_queue` item and writes an audit log.
10. Reviewers approve/reject staged rows through server routes.

## Enrichment

Supabase Edge Function:

- `supabase/functions/enrich-catalogue/index.ts`

Compatibility route for app-server callers:

- `POST /api/admin/catalogue/enrich-catalogue`

Lookup order:

1. Open Library
2. Google Books

The importer fills missing title, authors, publisher, year, subjects, cover URL, and language. It assigns one of:

- `clean_match`
- `needs_review`
- `no_match`
- `conflict`

AI is not used for normal ISBN lookup.

The app-server utility calls `supabase.functions.invoke('enrich-catalogue')`. A deterministic local fallback remains in place so development can continue before the Edge Function is deployed, but production should deploy the Edge Function to hosted Supabase now and self-hosted Supabase later.

## Approval

Routes:

- `POST /api/admin/catalogue/staging/[id]/approve`
- `POST /api/admin/catalogue/staging/[id]/reject`
- `POST /api/admin/catalogue/import/[batchId]/bulk-approve-clean`

On approve:

- A live `catalogue_items` row is created.
- `catalogue_copies` rows are created for the requested copy count.
- `tenant_id` is preserved.
- `catalogue_staging.status` becomes `approved`.
- An audit log is written.

On reject:

- A reason is required.
- `catalogue_staging.status` becomes `rejected`.
- An audit log is written.

## Migration

Added migration:

- `supabase/migrations/20260625152000_catalogue_csv_import.sql`

It creates:

- `catalogue_import_batches`
- `catalogue_staging`

It also adds `tenant_id` to live `catalogue_items` and `catalogue_copies` for migration-safe tenant enforcement.

The migration is Supabase-compatible and should be applied to both hosted Supabase during development and self-hosted Supabase during production migration.

## Security

- UI access is limited to librarian/admin roles by existing admin routing plus server-side checks.
- API routes call `requireRole` with library-admin roles.
- Supabase service-role key is used only in server route handlers/utilities.
- RLS restricts reads/updates to the current tenant.
- Inserts happen server-side.
- Enrichment lives in a Supabase Edge Function for hosted/self-hosted Supabase portability.

## Tests

Run:

```bash
npm run test
```

Coverage added for:

- required ISBN/title validation
- invalid item type/year/copies/shelf/source URL
- duplicate ISBN detection inside uploaded files
