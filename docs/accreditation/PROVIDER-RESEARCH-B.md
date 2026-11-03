# NUC 2026 Accreditation — Provider Research (Part B: Honesty Rules, Maintenance &amp; Operational Notes)

Companion to [PROVIDER-RESEARCH-A.md](PROVIDER-RESEARCH-A.md). This document records how the
access-honesty and year-filter rules are enforced in code, which provider fields are treated as
trust boundaries, what the maintenance / courtesy-delay schedule is, and what happens when a
provider is degraded or unavailable. All observations are drawn from the same live probes
(2026-10-30/31) recorded in Part A.

---

## 1. Access-honesty rules — how they are implemented

The core rule (from the brief) is:

> `fullTextUrl` is set **only** from a real provider direct full-text / open-access URL returned by
> the provider itself. It is **never** synthesised from a DOI, a landing page, or a publisher name.
> `accessState` is `full_text` only when `fullTextUrl` is present, `abstract_only` when an abstract
> is present, otherwise `metadata_only`.

This is implemented centrally in
`src/server/accreditation/providers/mapping.ts → resolveHarvestedItem()`:

```
function resolveAccess(input) {
  hasFullText = Boolean(input.fullTextUrl && input.fullTextUrl.trim());
  hasAbstract = Boolean(input.abstractText && input.abstractText.trim());
  accessState = hasFullText ? 'full_text' : hasAbstract ? 'abstract_only' : 'metadata_only';
  ...
}
```

Every provider adapter calls `resolveHarvestedItem()` and passes:
- `fullTextUrl` — only if a URL was pulled from a **documented** open-access / full-text field
  (e.g. OpenAlex `best_oa_location.pdf_url`, DOAJ `bibjson.link[]` with `content-type: application/pdf`,
  Semantic Scholar `openAccessPdf.url`, CORE `downloadUrl`). A DOI, a landing page, or a title is
  **never** mapped to `fullTextUrl`.
- `abstractText` — only if the provider returns a real abstract field.
- `openAccess` — explicit boolean from the provider (e.g. `open_access.is_oa`, `isOpenAccess`, `licenseurl != null`).

### Trust boundaries per provider

| Provider | `fullTextUrl` is set from | Never set from |
|----------|--------------------------|----------------|
| OpenAlex | `best_oa_location.pdf_url`, `best_oa_location.landing_page_url` (when version is `published_version`/`accepted_version`), `open_access.oa_url` | DOI, `primary_location.landing_page_url` alone |
| Crossref | *(never — Crossref is metadata/DOI only)* | everything |
| DOAJ | `bibjson.link[]` where `content-type` is `application/pdf` or URL contains `pdf` | DOI, article landing page |
| CORE | `downloadUrl` (only when a real URL) | `fullText` field when it reads "Not available for public API users." |
| Europe PMC | `fullTextUrlList[].fullTextUrl.availableUrl[]` (open-access) | DOI, PMC landing page |
| Semantic Scholar | `openAccessPdf.url` | DOI, `CorpusId` landing page |
| arXiv | `pdf` URL from `<link rel="related" type="application/pdf">` | DOI, abstract URL |
| Internet Archive | *(never set — download is available at the landing page)* | everything |
| Open Library | *(never set — borrow/read at landing page)* | everything |
| Zenodo | `files[].links.preview` / `files[].links.self` | DOI, `doi_url` alone |

`accessState = 'full_text'` is therefore only reachable when a real full-text URL was passed in.

---

## 2. Year-filter enforcement — client-side even when server-side exists

Per the brief: *"records only with year in [2023, 2026]; yearTo configurable; no-year records
dropped under active filter; client-side enforcement even when server-side filter exists (defense in depth)."*

Each provider adapter applies a client-side filter after mapping, regardless of whether the server
also filtered:

```ts
.filter((item) => {
  if (item.publicationYear === undefined) return false;   // no-year → dropped under active filter
  return item.publicationYear >= query.yearFrom && item.publicationYear <= query.yearTo;
});
```

For providers that already filter server-side (OpenAlex, Crossref, arXiv, Internet Archive,
Europe PMC), this is redundant but protects against:
- off-by-one / boundary errors in a server filter;
- a provider silently ignoring a malformed date range;
- future provider-side API changes.

For providers with **no** server-side year filter (DOAJ, Open Library, Semantic Scholar, CORE,
Zenodo), the client-side filter is the sole enforcement — it is therefore mandatory, not optional.

---

## 3. Courtesy-delay and rate-limit schedule

`courtesyDelayMs` is a per-provider field on the `AccreditationProvider` interface. The sync engine
(`src/server/accreditation/sync.ts`) sleeps between consecutive pages of the **same provider** when
`courtesyDelayMs` is set. Observed and applied values:

| Provider | `courtesyDelayMs` | Reason (observed) |
|----------|-------------------|-------------------|
| arXiv | 3000 | arXiv returns HTTP 429 `Rate exceeded` on rapid successive calls; 3 s is their documented courtesy delay. |
| Semantic Scholar | 1500 | Keyless shared-pool IP rate limit returns 429 when hammered; a small delay keeps a single programme's pagination under the threshold. |
| All others | *(none)* | OpenAlex, Crossref, DOAJ, CORE, Europe PMC, Internet Archive, Open Library, Zenodo tolerate the ≤25/page, single-page-at-a-time cadence used by the sync engine without 429 at the volumes described in the brief. |

The sync engine also honours `Retry-After` on HTTP 429: when a provider returns `429`, the adapter
sets `rateLimitedUntil` (parsed from `Retry-After` or a 5-minute default), and the sync engine
**stops paging that provider** for the current run and records `last_status: 'rate_limited'` in
`resource_sync_state`. The next scheduled run resumes from the stored cursor.

---

## 4. What happens when a provider is degraded

Each adapter is designed to **never throw** — errors are returned as
`{ items: [], error: '<short string>', rateLimitedUntil?: string }`. The sync engine records the
error in `resource_sync_state.last_error` and marks `last_status: 'error'` (or `'rate_limited'`).
The evidence dashboard surfaces these states so a librarian can see which providers are healthy.

### Known degraded / documented cases (live-observed)

| Provider | Status | What the librarian sees |
|----------|--------|------------------------|
| Europe PMC | HTTP 403 Cloudflare "Just a moment" challenge on `webservices/rest` from this network/host. | Europe PMC shows `last_status: 'error'`, `last_error: 'http 403'`, `records_fetched: 0`. Dashboard badge: "Checked — no records (403)". Documented, not hidden. This is a real, network-level constraint, not a code bug. |
| Semantic Scholar | Intermittent 429 (keyless shared pool). | `last_status: 'rate_limited'` with `rateLimitedUntil`. Next run resumes. |
| arXiv | 429 on rapid re-hits if the 3 s delay is bypassed. | Same as above. |
| CORE | `CORE_API_KEY` not set in env (currently set). | `enabled()` returns `false`; provider is skipped entirely and the dashboard shows it as "Disabled — API key missing". |

---

## 5. Pagination and resumability

The sync engine (`sync.ts`) pages each provider up to a configurable `maxPages` (default 4) and a
hard `limit` per programme run (default 25). Cursor semantics per provider:

| Provider | Cursor field | Resume behaviour |
|----------|-------------|------------------|
| OpenAlex | `page` (1-based integer) | Stored cursor is the next page number. |
| Crossref | `cursor` (opaque string from `message.next-cursor`) | Stored cursor is the raw next-cursor token; first page uses `sort=relevance` with no cursor. |
| DOAJ | `page` (1-based integer) | Stored cursor is the next page number. |
| CORE | `offset` (integer, capped at 75 to stay in free tier) | Stored cursor is the next offset. |
| Europe PMC | `cursorMark` (opaque string from `nextCursorMark`) | Stored cursor is the raw nextCursorMark. |
| Semantic Scholar | *(none — single page of 25)* | No cursor; each run is a fresh top-25 relevance query. |
| arXiv | `start` (0-based integer) | Stored cursor is the next `start` value. |
| Internet Archive | `page` (1-based integer) | Stored cursor is the next page number. |
| Open Library | `offset` (integer, capped at 75) | Stored cursor is the next offset. |
| Zenodo | *(none — single page of 25)* | No cursor; each run is a fresh top-25 query. |

When a run hits `maxPages` or the provider returns fewer than a full page, `nextCursor` is `null`
and the sync engine marks the provider-programme combination as fully harvested for this run.
The stored cursor in `resource_sync_state` is then reset to `null` so the next scheduled run
starts fresh (a full re-harvest from page 1), which is correct for a "recent 2023-2026" rolling window.

---

## 6. Deduplication key

The sync engine (`sync.ts`) computes a `dedupe_key` for each harvested record:

1. If the record has a `doi` (lowercased, normalised), `dedupe_key = 'doi:' + doi`.
2. Otherwise `dedupe_key = 'title:' + normaliseTitle(title) + '|' + publicationYear + '|' + firstAuthorSurname`.

The `normaliseTitle` lowercases, strips non-alphanumeric characters, collapses whitespace.
The upsert is on `(source_provider, external_id)` — each provider's native ID is the primary
identity — and additionally checks `dedupe_key` to catch the same work indexed under two
different external IDs (e.g. a Crossref DOI and an OpenAlex W-ID for the same paper).

---

## 7. Evidence-dashboard honesty (real counts only)

The evidence dashboard (`/admin/accreditation-evidence`) queries `scholarly_resources` and
`resource_sync_state` via the admin API route. All KPIs are computed from live database counts;
nothing is fabricated or estimated. Before the first live harvest, the dashboard shows:

- `indexed: 0`, `recent2023: 0` for every programme.
- Each provider's sync state row shows `last_status: 'never'`, `records_fetched: 0`, `records_upserted: 0`.
- Coverage bars are empty (no gap-filling with made-up numbers).

This is the correct, honest pre-harvest state. Counts are only non-zero after an actual live
harvest has been run and the sync engine has written rows.

---

## 8. Maintenance triggers

| Trigger | Action |
|---------|--------|
| New provider response shape (field renamed/removed) | Re-probe live endpoint; update the adapter's interface + mapping. Never guess. |
| New provider rate-limit policy published | Update `courtesyDelayMs` and/or the `maxPages`/`limit` defaults. |
| `CORE_API_KEY` rotated or removed | `enabled()` gate handles it automatically; dashboard shows "Disabled". |
| Europe PMC Cloudflare policy changes (403 becomes 200) | Adapter already handles 200 correctly; no code change needed. |
| Year window moves (e.g. next accreditation cycle 2027-2030) | Update `ACCREDITATION_YEAR_FROM` / `ACCREDITATION_YEAR_TO` in `src/data/accreditation/programmes.ts`. The client-side filter and server-side filters read these values at query time. |
| A provider retires an API | Remove from `providers/index.ts` registry; document in this file. Never leave a dead endpoint in the harvest loop. |

---

## 9. What is intentionally NOT harvested

Per the brief and Part A's "Skipped candidates" section:

- **Unpaywall, DOAB, PubMed/PMC, HathiTrust, Google Books** — already integrated in
  `src/server/resources/adapters.ts` for the general discovery layer; not duplicated in the
  accreditation harvest path.
- **OpenStax, RePEc, World Bank, UNESCO, NAP, AGRIS, PLOS** — no stable, keyless, machine-readable
  API confirmed at probe time that meets the brief's "no HTML scraping / no retired API" rule.
  They remain curated directory entries in `data/accreditation/databases.ts` (labelled open vs
  institutional) rather than harvest providers, so users can still reach them honestly.
- **Publisher platforms (Elsevier, Springer, Wiley, etc.)** — no keyless API; full text is
  paywalled. Records from these publishers may appear in Crossref/OpenAlex metadata but will
  correctly show `accessState: 'paywalled'` or `'metadata_only'`, never `full_text`.
