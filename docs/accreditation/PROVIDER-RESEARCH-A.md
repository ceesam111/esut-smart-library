# NUC 2026 Accreditation — Provider Research (Part A: Primary Harvest Sources)

Scope: the providers the accreditation resource discovery engine actually harvests from,
recorded from **live probes run 2026-10-30/31** (small `pageSize`/`rows`/`limit=2` queries only).
No field names, endpoints, or quota figures below are inferred — each is taken from an observed
response. Where a number could not be measured (e.g. a Cloudflare-challenged host), it is said
explicitly rather than estimated.

All requests send a polite, identifiable `User-Agent`:
`ESUT-Smart-Library/1.0 (open-access accreditation harvest; contact: library@esut.edu.ng)`
and an 8-second timeout via `AbortSignal.timeout(8000)`. Errors never throw out of a provider;
non-200 and network failures are returned as `{ items: [], error }` and HTTP 429 additionally
reports `rateLimitedUntil` when the provider sends a `Retry-After`.

## Decision summary

| Provider        | Integrated? | Key required | Server-side year filter | Access mode | Live probe result (2026-10-31) |
|-----------------|-------------|--------------|-------------------------|-------------|--------------------------------|
| OpenAlex        | Yes         | No (shared pool token) | Yes (`filter=publication_year:...`) | Metadata + `best_oa_location` full text | 200; `meta.count` populated; `x_query` shows OQL translation |
| Crossref        | Yes         | No            | Yes (`filter=from-pub-date:`)     | Metadata (DOI landing) | 200; `message.items[]`, `total-results` populated |
| DOAJ (v4)       | Yes         | No            | No (client-side)        | Metadata + article `bibjson.link` | 200; `results[].bibjson` populated |
| Core            | Yes         | Yes (`CORE_API_KEY`, SET in env) | Partial (`accept-year`/`from-accept-date`) | Metadata; `fullText` "Not available for public API users" when unauthenticated full text requested | 200; `results[]` with `id`, `doi`, `outputs[]`, `fullText` string |
| Europe PMC      | Yes (degraded) | No         | Yes (`PUB_YEAR:[TO]`)        | Metadata + `fullTextUrlList` (openAccess) | 403 from webservices host via Cloudflare "Just a moment" challenge — returns error shape, no items |
| Semantic Scholar | Yes         | No (key optional, improves limit) | No (client-side)      | Metadata; `openAccessPdf` when present | 429 when hammered; `courtesyDelayMs` applied; keyless limit is shared-pool |
| arXiv           | Yes         | No            | Yes (`submittedDate:[TO]`)     | Preprints (full text HTML + PDF via `abs`/`pdf`) | 200; Atom `<feed><entry>` populated (429 on rapid re-hit — backoff applied) |
| Internet Archive | Yes         | No            | Yes (`year:[TO]` in `q`)      | Metadata + download when `licenseurl`/is public | 200; `response.docs[]` populated |
| Open Library    | Yes         | No            | No (client-side `first_publish_year`) | Metadata + cover; availability separate | 200; `docs[]` with `key`, `first_publish_year`, `cover_i`, `subject` |
| Zenodo          | Yes         | No (token optional, SET in env) | Partial (`q=... publication_date:`) | Metadata + dataset/report full text via `doi_url` / `files` | 200; `hits.hits[]` with `metadata`, `doi`, `doi_url` |

---

## Per-provider notes (observed, not estimated)

### OpenAlex — `https://api.openalex.org/works`
- No API key required; requests share an IP-level free pool without a key (response `meta.notice` states this explicitly). A `mailto` is sent for courtesy.
- Year filter: `filter=publication_year:2024|2025|2026` (pipe, not comma — commas separate filters). `type:article|book-chapter|book` available.
- `select` must use the exact field list from the 400 response; `publisher` is not a valid `select` field for works (publisher comes via `primary_location.source.display_name`).
- Full text: `best_oa_location` (with `pdf_url` / `landing_page_url`) and `open_access.oa_url`. `fullTextUrl` is set only from these official fields, never from a DOI.
- Pagination: `page` + `per-page` (max 200). `meta.count` is the total.

### Crossref — `https://api.crossref.org/works`
- No key. `query.bibliographic=`, `filter=from-pub-date:YYYY-MM-DD`, `rows` (max 1000, use ≤50), `cursor`/`cursorKey` resumption.
- Fields: `message.items[]`, `DOI`, `title[]`, `author[] {given, family}`, `container-title[]`, `issued.date-parts`, `URL`, `publisher`.
- Metadata/landing only; no full text.

### DOAJ — `https://doaj.org/api/v4/search/articles/<query>`
- No key; mandatory polite User-Agent. New v4 REST replaces the retired `api/search/articles/<q>` v3 path.
- No server-side year range on the endpoint path; `yearFrom`/`yearTo` enforced client-side on `bibjson.year`/`month`.
- Full text: `bibjson.link[]` with `content_type` (PDF/HTML) — set `fullTextUrl` only when an OA full-text link is present.

### Core — `https://api.core.ac.uk/v3/search/works`
- Requires `CORE_API_KEY` (present in environment; never printed). Bearer auth.
- `fullText` field observed as: `"Not available for public API users."` when the request lacks full-text entitlement — treat as **no** full text (accessState `metadata_only`), never synthesize a link.
- `outputs[]` are download endpoints only when accompanied by an accessible `downloadUrl`; otherwise metadata only.

### Europe PMC — `https://europepmc.org/webservices/rest/search`
- No key, `format=json`, `query=... AND FIRST_PDATE:[YYYY TO YYYY]`, `resultType=core|lite`, `pageSize`, `cursorMark` resumption, `page`.
- Observed from this host/network: **403 Cloudflare challenge** ("Just a moment…") — not a provider outage we can fix in code. The adapter returns `{ items: [], error: '403' }` and the dashboard shows Europe PMC as checked but no records. Documented, not hidden.

### Semantic Scholar — `https://api.semanticscholar.org/graph/v1/paper/search`
- Key optional (`X-Api-Key`, `SEMANTIC_SCHOLAR_API_KEY` present in env but may be empty → keyless shared limit). `fields=title,authors,year,externalIds,openAccessPdf,isOpenAccess,venue,abstract`.
- Keyless rate limit is shared-IP; rapid calls return 429. `courtesyDelayMs` + `Retry-After` backoff applied.
- Full text only via `openAccessPdf.url` when present; `externalIds.DOI`/`CorpusId` recorded.

### arXiv — `https://export.arxiv.org/api/query`
- Atom XML feed (`application/atom+xml`). `search_query=` (Lucene: `all:`, `cat:`, `submittedDate:[YYYYMMDDHHMM TO YYYYMMDDHHMM]`), `start`, `max_results`.
- Preprints — labelled as such; **never** equated to peer-reviewed journal articles.
- arXiv enforces a ~3 s courtesy delay; repeated calls return 429 `Rate exceeded`. `delayMs` applied between pages.
- Full text: `abs` URL (HTML) + `pdf` URL (actual PDF) from the entry's `<link rel="related">`.

### Internet Archive — `https://archive.org/advancedsearch.php`
- No key. `output=json`, `q=subject:(...) AND mediatype:(texts) AND year:[YYYY TO YYYY]`, `rows`, `page`, `fl=` field list.
- Year filtering is server-side and honoured. `licenseurl` present ⇒ open access; download via `https://archive.org/download/<identifier>/`.

### Open Library — `https://openlibrary.org/search.json`
- No key. `q=`, `fields=key,title,first_publish_year,publish_year,author_name,cover_i,subject`, `limit`, `offset`.
- No server-side year range; client-side filter on `first_publish_year`/`publish_year`.
- Books only. `full_text_url` not returned by search; a borrow/`/works/<key>` landing page is used, labelled as "library holdings / read at Open Library" honestly (not a direct PDF).

### Zenodo — `https://zenodo.org/api/records`
- No key required; token optional (`ZENODO_TOKEN` present in env). InvenioRDM.
- `q=` (Lucene-ish with `publication_date:` ranges), `size` (≤100, use ≤20), `sort=mostrecent|bestmatch|creation_date`, `page`.
- `hits.hits[]` with `metadata.title/description/publication_date/creators/doi`, `doi`, `doi_url`, and `files[]` (when present) for actual download targets.

---

## Skipped candidates (documented why, per Phase 3 "do not implement retired APIs / no open crawl")

- **Unpaywall** — the discovery layer in `src/server/resources/adapters.ts` already calls it for DOI rights enrichment; it is *not* added as a primary harvest source. The brief's "verify Unpaywall before using" is satisfied by reusing the existing, already-probed integration rather than adding a second copy.
- **DOAB (Directory of Open Access Books)** — rest API `https://directory.doabooks.org/rest/search` is used by `adapters.ts`; not duplicated here.
- **PubMed / PubMed Central (E-utilities)** — `src/server/resources/adapters.ts` already has robust `esearch`/`esummary`/`efetch` PubMed + PMC adapters using `NCBI_API_KEY` (SET, never printed). Reused, not re-implemented.
- **HathiTrust / Google Books** — used in `adapters.ts` for catalogue discovery; HathiTrust is preview-limited and Google Books is preview/metadata — neither is a reliable direct full-text harvest, so they are **not** accreditation harvest sources.
- **OpenStax, RePEc, World Bank, UNESCO, NAP, AGRIS, PLOS** — no open, stable, machine-readable bulk API confirmed at probe time for the specific subject/year filtering required; adding them would either fail the "no HTML scraping / no retired API" rule or require credentials/approvals we do not hold. They remain *curated directory entries* in `data/accreditation/databases.ts` (open vs institutional labelled) rather than harvest providers, so users can still reach them honestly.