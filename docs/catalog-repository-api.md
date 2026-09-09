# Catalog and Institutional Repository API

## GET `/api/catalog`

Returns OPAC/catalog records only. Repository material types are excluded.

Query parameters:

- `q`: optional search term for title, ISBN, ISSN, or call number.
- `limit`: optional result limit, maximum `100`.

Response fields include `id`, `title`, `authors`, `isbn`, `issn`, `call_number`, `total_copies`, `available_copies`, `library_code`, `shelf_code`, `format`, and `year`.

## GET `/api/repository`

Returns Institutional Repository records only.

Query parameters:

- `q`: optional search term for title, abstract, or department.
- `department`: optional department filter.
- `limit`: optional result limit, maximum `100`.

Response fields include `id`, `title`, `authors`, `item_type`, `abstract`, `keywords`, `department`, `year`, `doi`, `handle`, `license`, `embargo_until`, `file_url`, and `status`.

## GET `/api/catalog/legacy/{id}`

Looks up a migrated catalog ID and returns the repository URL for redirect handling.

Deployment note: configure the edge/proxy layer to issue HTTP `301` from `/catalog/{id}` to the returned `repositoryUrl` when this endpoint returns `found: true`.

## Sitemaps

- `/catalog-sitemap.xml`
- `/repository-sitemap.xml`

## Migration

Run a dry run first:

```bash
npm run migrate:catalog-ir
```

Apply the database migration in `supabase/migrations/20260705120000_catalog_ir_separation.sql`, then run without `--dry-run` only after staging verification:

```bash
npx tsx scripts/migrate-catalog-ir.ts
```

The migration copies matching records and keeps `catalogue_items` untouched for the 30-day rollback window.
