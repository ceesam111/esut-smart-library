# OAI-PMH 2.0 Data Provider — ESUT Smart Library

## Status: IMPLEMENTED (2026-09-27)

Endpoint: `/api/oai` · Source: `app/api/oai/route.ts` · Helpers: `src/server/oai/oaiXml.ts` · Tests: `app/api/oai/route.test.ts`

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `OAI_ENABLED` | (unset) | Must be `"true"` to serve requests; otherwise returns HTTP 404 |
| `OAI_BASE_URL` | `https://esutlibrary.edu.ng/api/oai` | Advertised baseURL in Identify + request elements |
| `OAI_AUTHORITY` | derived from baseURL hostname | oai: identifier authority (e.g. `oai:esutlibrary.edu.ng:<uuid>`) |
| `OAI_REPO_NAME` | `ESUT Digital Repository` | Identify.repositoryName |
| `OAI_ADMIN_EMAIL` | `library@esut.edu.ng` | Identify.adminEmail |
| `OAI_TOKEN_SECRET` | falls back to `SUPABASE_SERVICE_ROLE_KEY` | HMAC-SHA256 signing key for resumptionTokens |

## Protocol conformance

- **Verbs**: Identify, ListMetadataFormats, ListSets, ListRecords, ListIdentifiers, GetRecord — all implemented.
- **metadataPrefix**: `oai_dc` only (real Dublin Core serialization). The previously advertised `oai_marc` was removed — MARC21 comes in WAVE 3.
- **Datestamps**: full UTC `YYYY-MM-DDThh:mm:ssZ` everywhere (responseDate, datestamps, earliestDatestamp).
- **Granularity**: `YYYY-MM-DDThh:mm:ssZ`; date-only (`YYYY-MM-DD`) also accepted.
- **deletedRecord**: `no`.
- **Sets**: `repository_communities.slug` (setSpec) / `name` (setName). Item-level setSpec = `faculty_code`; filtering by `set=` uses `faculty_code`.
- **Pagination**: signed resumptionTokens (HMAC-SHA256 over `offset:prefix:expires`), 30-minute TTL, `completeListSize`/`cursor`/`expiration` attributes, PAGE_SIZE=100.
- **Errors**: `badVerb`, `badArgument`, `cannotDisseminateFormat`, `idDoesNotExist`, `noRecordsMatch`, `badResumptionToken`, `internalError` — each with a proper `<error>` element.

## Bugs fixed vs the old `supabase/functions/oai-pmh/index.ts`

1. BaseURL now env-configurable (was hardcoded to a 404 URL).
2. Double-nested `<header>` removed.
3. `oai_marc` no longer advertised (was silently returning oai_dc).
4. Set filter now matches ListSets (was `faculty_code` vs community slug mismatch).
5. GetRecord enforces `visibility='global'` (was unprotected).
6. Ordering by `updated_at` (datestamp field), not `created_at`.
7. Empty final page with valid token returns empty ListRecords/ListIdentifiers (was noRecordsMatch).
8. Token prefix honored on continuation.
9. Tokens signed + expiring (were unsigned `btoa`).
10. `completeListSize`/`cursor`/`expiration` attributes present.
11. Missing `verb` returns `badVerb` (unchanged, correct).
12. Date granularity validated → `badArgument` (was internalError).
13. Fractional-seconds `responseDate` removed.
14. `earliestDatestamp` sourced from the same `updated_at` field used for datestamps.

## Data source

`repository_items` where `status='published'` AND `visibility='global'`. The `ir_items` reconciliation (unify both models into one source) is tracked in WAVE 1/2 — when complete, repoint the provider's queries.

## Interop testing

- Unit tests: `app/api/oai/route.test.ts` (helper correctness).
- Live: `curl 'https://esutlibrary.edu.ng/api/oai?verb=Identify'` (after `OAI_ENABLED=true` on VPS).
- Recommended external check: validate with an OAI-PMH validator (e.g. https://validator.openarchives.org/ or DSpace's).

## Rollback

Set `OAI_ENABLED=false` (or unset) — endpoint returns 404. No data migrations involved.
