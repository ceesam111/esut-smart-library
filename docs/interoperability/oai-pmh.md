# OAI-PMH Interoperability

## Status

| | |
|---|---|
| Protocol | OAI-PMH 2.0 |
| Endpoint (configured) | `https://esutlibrary.edu.ng/api/oai` |
| Endpoint (actual) | **Not publicly reachable** — `esutlibrary.edu.ng` does not resolve in DNS |
| Feature flag | `OAI_ENABLED` (must be `true`; not set in any local `.env`) |
| Metadata formats | `oai_dc` only |
| Sets | `repository_communities.slug` |
| Deleted records | `no` |
| Granularity | `YYYY-MM-DDThh:mm:ssZ` |
| Maturity | **LEVEL 4 / BLOCKED_EXTERNAL_VALIDATION** |

## 9.1 Audit — exact behaviour before Batch 9

### Route

`app/api/oai/route.ts` (119 lines) handles all six verbs in a single `GET` handler.
`src/server/oai/oaiXml.ts` (55 lines) holds the shared helpers. There is no separate
service layer; the route builds XML inline.

### Protocol conformance

Correct:

- Root `<OAI-PMH>` with the OAI-PMH 2.0 namespace and `xsi:schemaLocation`.
- `<responseDate>` in `YYYY-MM-DDThh:mm:ssZ`.
- `<request>` echo with verb and parameters.
- `Identify`, `ListMetadataFormats`, `ListSets`, `ListIdentifiers`,
  `ListRecords`, `GetRecord` all implemented.
- `badVerb`, `badArgument`, `cannotDisseminateFormat`, `idDoesNotExist`,
  `noRecordsMatch`, `badResumptionToken` error codes.
- Resumption tokens are opaque base64 JSON with HMAC-SHA256 signatures and a
  30-minute expiry.

### Defects found by the audit

| # | Defect | Severity |
|---|---|---|
| D1 | **Embargo is not enforced.** `embargo_until` is selected but never filtered, so an embargoed item with `status='published'` and `visibility='global'` is fully harvestable. | **Critical — access leak** |
| D2 | **Set vocabulary mismatch.** `ListSets` emits `repository_communities.slug` as `setSpec`, but `set=` filtering compares against `repository_items.faculty_code`. Filtering by a advertised setSpec returns nothing. | High |
| D3 | **No per-record `setSpec`.** Record headers carry no `setSpec`, so a harvester cannot tell which set a record belongs to. | Medium |
| D4 | **Resumption token loses query context.** The token stores only `offset` and `metadataPrefix`; `from`, `until` and `set` are dropped on continuation, so a filtered harvest silently becomes unfiltered. | High |
| D5 | **`earliestDatestamp` inconsistency.** `Identify.earliestDatestamp` uses `created_at` while record datestamps and filtering use `updated_at`. | Medium |
| D6 | **Hard-coded base URL.** The item URL `https://esutlibrary.edu.ng/repository/{handle}` and the default `OAI_BASE_URL` point at a domain that does not resolve. | High |
| D7 | **No `noSetHierarchy`.** The spec requires this error when a repository does not support sets; it is never returned. | Low |
| D8 | **No observability.** No logging, metrics or harvest tracking for OAI requests. | Medium |
| D9 | **No rate limiting or page-size cap.** `PAGE_SIZE` is fixed at 100 and cannot be tuned; there is no abuse protection. | Medium |
| D10 | **Only `oai_dc`.** No DataCite or MARCXML format despite the repository carrying DOI, creators, publisher, subjects, language and rights. | Medium |
| D11 | **MARCXML infrastructure is disconnected.** `src/server/catalogue/marcXml.ts` exists and works but is never called from OAI. | Low |
| D12 | **Test coverage is helper-only.** Six unit tests cover `oaiXml.ts` helpers. Nothing exercises the route, the verbs, the XML structure, error paths, tokens or filtering. | High |

### Access model applied

`status = 'published'` **and** `visibility = 'global'`. Drafts, submissions,
reviews, rejections and private items are excluded. Embargoed items are **not**
excluded (D1). No file URLs, signed URLs or storage keys are emitted — only the
public item URL and the DOI URL.

### Resumption token model

```
token = base64(JSON({ offset, prefix, expires, hmac }))
hmac  = HMAC-SHA256("{offset}:{prefix}:{expires}", secret)
TTL   = 30 minutes
secret = OAI_TOKEN_SECRET ?? SUPABASE_SERVICE_ROLE_KEY
```

Tokens are opaque, signed and expiry-aware. They are **not** independent of
client manipulation in one respect: the signed payload covers only `offset`,
`prefix` and `expires`, so any additional context must be added to the payload
to be protected (see D4).

### Test data

`supabase/migrations/20260930050000_oai_test_data.sql` inserts four items
(article, thesis, dataset, embargoed article) plus three files. There is no
private item, no withdrawn item, and fewer than 100 records, so resumption
tokens are never exercised by the existing data.

## Batch 9 target

Close D1–D12, add DataCite and MARCXML crosswalks, add real integration tests
for all six verbs, add observability and abuse protection, and attempt external
validation. Because the configured host does not resolve, external validation
is expected to remain **BLOCKED_EXTERNAL_VALIDATION** and the maturity level
stays **LEVEL 4**.
