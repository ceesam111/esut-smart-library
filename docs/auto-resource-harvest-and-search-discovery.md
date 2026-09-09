# Auto Resource Harvest And Search Discovery

The implementation keeps the local Supabase catalogue as the first source of truth. External sources are fallback discovery sources and every discovered record is stored as a tenant-scoped `resource_candidate` before it can become a live catalogue item.

## Database

- `resource_harvest_sources`: tenant source configuration for scheduled/manual harvests.
- `resource_harvest_runs`: job/run history for scheduled, manual, and search-triggered discovery.
- `resource_candidates`: normalized external metadata, rights status, duplicate state, B2 key, and promotion link.
- `resource_discovery_logs`: user/admin search misses, sources queried, counts, duplicates, and errors.
- `catalogue_items`: extended with source attribution, rights/licence, B2 object key, freshness fields, and metadata quality.

RLS only allows admins/librarians to read candidate and discovery queues for their own tenant. Public users do not read pending candidates directly. Inserts and promotion are done server-side with the service role.

## Sources

Adapters live in `src/server/resources/adapters.ts`.

- Open Library: books, ISBN metadata, covers.
- Google Books: metadata only.
- DOAB: open-access books.
- DOAJ: open-access articles/journals.
- OpenAlex: scholarly metadata and OA links.
- CrossRef: DOI metadata and deduplication.
- Internet Archive: restricted to legal/open/public text queries.
- CORE: optional when `CORE_API_KEY` exists.

All adapters normalize into `ResourceCandidate` and preserve `source_name`, `source_record_id`, `source_url`, and `raw_metadata`.

## Search Flow

`GET /api/search/resources?q=...` searches `catalogue_items` first and ranks local results. If local quality is good, no external API is called.

When local quality is weak or none, the response offers external lookup. `GET /api/search/resources?q=...&expand=true` rate-limits the request, queries enabled adapters, stages valid candidates, deduplicates them, logs discovery, and returns clearly labeled pending external cards.

Patrons can request review with `POST /api/resource-requests/external`. This links an existing `resource_candidate` to `resource_requests`; it does not publish the record.

## Admin Flow

`/admin/harvest` supports manual harvests, run history, candidate review, and discovery logs.

Admin endpoints:

- `GET /api/admin/harvest`
- `POST /api/admin/harvest`
- `POST /api/admin/harvest/candidates/:id/approve`
- `POST /api/admin/harvest/candidates/:id/reject`

Approval promotes a candidate into `catalogue_items`. Rejection keeps an audit trail.

## Deduplication

Before staging or promotion, the server checks:

- ISBN exact.
- DOI exact.
- ISSN plus title.
- `source_name` plus `source_record_id`.
- Normalized title plus year plus first author.
- Existing live catalogue, `resource_candidates`, and `catalogue_staging`.

Duplicates are marked `duplicate` and are not published.

## Rights And B2

Rights logic is in `src/server/resources/rights.ts`.

- Clear open/public-domain rights can queue `resources.downloadToB2`.
- Unclear rights become metadata-only and need review.
- Google Books and CrossRef are metadata-first sources.
- Internet Archive queries are constrained to legal/open/public text records.

Legal file keys use:

`tenants/{tenant_id}/resources/{source_name}/{year}/{safe_id}/{filename}`

The current search response queues a worker-compatible job descriptor instead of downloading large files synchronously.

## Worker Jobs

Job names are defined in `src/server/resources/jobs.ts`:

- `resources.harvest`
- `resources.searchExternal`
- `resources.normalizeCandidate`
- `resources.deduplicate`
- `resources.downloadToB2`
- `resources.refreshMetadata`
- `resources.promoteCandidateToCatalogue`

Coolify can later run a worker container that consumes these job descriptors from a queue table or external queue.

## Safety

- External metadata is untrusted and never directly publishes public holdings.
- AI is not used in the default path.
- External lookup is rate-limited per tenant/user.
- One failing source does not break local search or other sources.
- Tenant IDs are applied to every table and query.
