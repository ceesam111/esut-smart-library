# Search Architecture

Status: **Batch 8 baseline audit.** This document describes the search pipeline as it
exists in the codebase *before* Batch 8 changes, verified against the hosted
Supabase project `rnnjspkdjoigncdgmdgy` on 2026-10-01. Where an earlier audit
disagrees with what the code and live schema show, the code and live schema win.

---

## 1. Two separate search systems

The platform has **two independent search pipelines** that share no code.

| | Repository search | Catalogue search |
|---|---|---|
| Table | `repository_items` | `catalogue_items` |
| Route | `GET /api/repository` | `GET /api/catalog`, `GET /api/sru` |
| Service | none (inline in the route) | `src/server/resources/localSearch.ts` |
| FTS column | `repository_items.search_vector` | `catalogue_items.search_vector` |
| Ranking | `created_at desc` | `scoreRow()` heuristic, then client sort |
| Access filter | `status='published'`, `visibility='global'`, embargo | **none** |

A third route, `GET /api/search/resources`, searches `catalogue_items` and then
expands into 15 external APIs (`src/server/resources/discovery.ts`).

---

## 2. PostgreSQL full-text search today

### 2.1 What exists

`supabase/migrations/20260927180000_fts_search_vectors.sql` adds a
`search_vector tsvector` column, a refresh function, a `BEFORE INSERT OR UPDATE`
trigger and a GIN index for three tables:

| Table | Vector weights | Index |
|---|---|---|
| `repository_items` | A=`title`, B=`abstract`, C=`keywords`, D=`department` | `idx_repository_items_search` (GIN) |
| `catalogue_items` | A=`title`, B=`authors`, C=`subjects_text`, D=`isbn` | `idx_catalogue_items_search` (GIN) |
| `ir_items` | A=`title`, B=`abstract`, C=`keywords`, D=`department` | `idx_ir_items_search` (GIN) |

Live verification confirms all three `search_vector` columns and all three GIN
indexes exist in `rnnjspkdjoigncdgmy`.

### 2.2 What does not exist

- **No `ts_rank` / `ts_rank_cd` anywhere.** The `setweight` weights are stored in
  the vector but never used for scoring.
- **No `ts_headline` anywhere.** No snippet or highlight production exists.
- **No query-side functions.** No `to_tsquery`, `plainto_tsquery`,
  `websearch_to_tsquery`, no search RPC. All querying is done from the client
  with PostgREST's `textSearch`, which is a boolean match filter only.
- **No extracted text in any vector.** `repository_items.search_vector` is built
  from metadata only.

### 2.3 Consequence

`textSearch('search_vector', q, { type: 'websearch' })` returns *matching* rows in
an order PostgreSQL chooses, and every route then overrides that with
`.order('created_at', { ascending: false })`. **A document whose title matches the
query exactly ranks below a newer document that only mentions it in the abstract.**

---

## 3. Repository search route

`app/api/repository/route.ts` (57 lines, the whole implementation):

```typescript
let query = supabase
  .from('repository_items')
  .select('...', { count: 'exact' })
  .eq('status', 'published')
  .eq('visibility', 'global')
  .or(`embargo_until.is.null,embargo_until.lt.${now}`)
  .order('created_at', { ascending: false })
  .limit(limit);
if (q) query = query.textSearch('search_vector', q, { type: 'websearch' });
if (department) query = query.eq('department', department);
```

Then a second query fetches `repository_files` for the returned item ids and
groups them in memory.

### 3.1 Gaps

| Gap | Detail |
|---|---|
| No relevance ranking | `created_at desc` only |
| No pagination metadata | returns `count` and `data`, but no `page`, `pageSize`, `totalPages`; `limit` is a hard cap, not an offset |
| No filters | only `department`; no faculty, year, type, subject, access level |
| No facets | no counts anywhere |
| No snippets | `abstract` returned in full |
| No file access awareness | file `access_level` is ignored entirely |
| N+1 risk | one extra query for files (acceptable at 25 rows, wrong at 100) |
| `any` types | `itemIds` and `filesByItem` use `any` |

---

## 4. Access control today

### 4.1 The model

| Layer | Column | Values |
|---|---|---|
| Item visibility | `repository_items.visibility` | `global`, `faculty`, `private` |
| Item status | `repository_items.status` | `submitted`, `review`, `approved`, `published`, `rejected` |
| Item embargo | `repository_items.embargo_until` | `timestamptz` |
| File access | `repository_files.access_level` | `PUBLIC`, `AUTHENTICATED`, `FACULTY`, `RESTRICTED`, `PRIVATE` |
| File embargo | `repository_files.embargo_until` | `timestamptz` |

`EMBARGOED` is a temporal state, not an access level.

### 4.2 Where it is enforced

| Location | Enforces |
|---|---|
| `app/api/repository/route.ts:17-18` | published + global + not embargoed |
| `app/api/oai/route.ts` | published + global |
| `src/server/repository/fileService.ts:71-84` | at **download** only: embargo, `PRIVATE`, `RESTRICTED` |
| `src/server/storage/secureDownload.ts:29-49` | at **download** only: embargo, `private`, `faculty` visibility |
| `src/app-pages/Catalogue.tsx:374-378` | client-side `visibility` filter |

### 4.3 The P0 gap

**File-level access control is not applied in search.** `/api/repository` filters
items by `visibility='global'` but then attaches *every* file of those items,
including `PRIVATE` and `RESTRICTED` ones, and returns their filenames, MIME types
and sizes to any anonymous caller. The file *contents* are not exposed, but the
metadata is, and — more importantly — **no extracted file text is searchable
today, so a private file's text cannot leak through search either.** That safety
is accidental, not designed. As soon as full-text extraction is added, it becomes
a real leak unless indexing is access-aware from the start.

Also inconsistent: `/api/catalog` and `/api/sru` apply **no** visibility filter at
all, and the client-side repository listing applies no embargo filter.

---

## 5. Extraction today

`src/server/preservation/textExtraction.ts` is the only extraction code.

```typescript
export async function extractText(file: Buffer, mimeType: string) {
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'application/json') {
    return { text: file.toString('utf-8') };
  }
  return null;   // PDF, DOCX, everything else
}
```

### 5.1 Two defects

1. **The `extracted_text` column does not exist.** `extractFileText` writes
   `extracted_text: result.text.slice(0, 100000)` at line 50, but no migration has
   ever added that column. Live `information_schema` confirms `repository_files`
   has `extracted_text_status` but **no** `extracted_text`. Every extraction run
   therefore throws at the `UPDATE`, is caught, and marks the file `FAILED`.
   Extraction has never once succeeded for any format.
2. **Nothing calls it.** No worker handler, no API route, no upload path invokes
   `extractFileText`. `uploadRepositoryFile` inserts
   `extracted_text_status: 'PENDING'` and stops.

There is no extraction job type in `worker/handlers/index.ts`, no PDF or DOCX
library in `package.json`, and no OCR.

### 5.2 Status values in use

`extracted_text_status` is a free `text` column defaulting to `'pending'`. Values
already written by existing code: `PENDING`, `PROCESSING`, `COMPLETE`, `FAILED`,
`NOT_SUPPORTED`. Batch 7's restore writes `'pending'`.

---

## 6. Worker infrastructure

Jobs live in `agent_jobs` and are claimed by `claim_agent_jobs(_worker_id, _limit,
_lock_timeout_minutes)` (`supabase/migrations/20260626143000_agent_jobs_worker_runtime.sql`),
which uses `FOR UPDATE SKIP LOCKED`, increments `attempts`, and honors
`max_attempts` (default 3) and `run_after`.

`worker/scheduler.ts` enqueues due rows from `agent_schedules` on an interval.
`worker/config.ts` defaults: concurrency 2, poll 5 s, lock timeout 15 min,
scheduler interval 60 s.

Registered job types (`worker/handlers/index.ts`):

```
catalogue.enrich, resources.harvest, resources.downloadToB2,
repository.extractMetadata, communications.draftNewsletter,
reports.weeklyTenantReport, system.healthCheck,
circulation.overdueReminders, circulation.sendOverdueEmails,
circulation.sendDueSoonEmails, preservation.verifyFixity,
preservation.fixityProducer
```

There is **no** `repository.extractText` and **no** `search.reindex`.

---

## 7. AI / retrieval integration

- `src/server/ai/brain.ts:56` — `generateSearchExplanation()`, an on-demand Lyria
  agent that explains results and suggests follow-ups. Not invoked automatically.
- `supabase/functions/federated-search/index.ts` — legacy edge function with an
  AI summary. Explicitly marked deprecated in favour of `/api/search/resources`.
- `src/server/resources/discovery.ts` — external API expansion on search miss.

**No pgvector, no embeddings, no RAG.** `search_vector` is a `tsvector`, not an
embedding. Any AI that consumes repository search results today receives whatever
the route returns, with no access filtering applied to file text.

---

## 8. What Batch 8 must change

| Requirement | Current state | Target |
|---|---|---|
| 8.2 Extraction pipeline | nothing is wired | async worker job, 6 statuses |
| 8.3 PDF | unsupported | `pdf-parse` (pdfjs-dist), page limits, `NO_TEXT_LAYER` |
| 8.4 DOCX | unsupported | `mammoth`, paragraphs/headings/tables |
| 8.5 OCR | absent | optional adapter, `BLOCKED_EXTERNAL` when unconfigured |
| 8.6 Formats | txt/csv/json only | + pdf, docx, odt, html |
| 8.8 Index weights | A/B/C/D metadata only | + D for extracted full text, `ts_rank` |
| 8.9 Per-file provenance | none | per-file access/embargo/version recorded |
| 8.10 Access-aware search | file access ignored | server-side evaluation, no private text indexed |
| 8.11 Embargo + reindex | filter only on one route | reindex on access change |
| 8.12 Version awareness | none | current version indexed, history retained |
| 8.13–8.16 Facets/filter/sort/pagination | client-side, no counts | server-side, counted |
| 8.17 Snippets | none | `ts_headline` on eligible text |
| 8.19 Scholar metadata | not verified | `citation_*` on public pages only |
| 8.20 AI safety | unfiltered | AI receives only authorized text |
| 8.21 Reindex | none | per item / per file / full, background |
| 8.22 Retry | `max_attempts` only | transient vs permanent vs unsupported |
| 8.23 Observability | none | extraction metrics in worker health |

---

## 9. Batch 8 outcome (what changed)

The gaps in section 8 were closed as follows.

| Gap | Resolution |
|---|---|
| No relevance ranking | `repository_search()` RPC ranks with `ts_rank` over a weighted vector (A=title, B=authors/subjects/keywords, C=abstract, D=file text). |
| No snippets | `ts_headline` over abstract then extracted text; `<b>` markers stripped so snippets are plain text and XSS-safe. |
| No facets | The RPC returns counted facets (resource type, year, faculty, department, author, subject, access level) computed over the filtered set. |
| No file access awareness | `repository_search_documents` holds one row per file, each with its own `access_level` and `embargo_until`. The RPC filters per caller using `is_library_admin()` and the caller's patron faculty. |
| No embargo consistency | Embargo is evaluated at query time, so expiry and restriction take effect immediately with no reindex. |
| No version awareness | Rows carry `is_current_version`; `DISTINCT ON (item)` prefers the current version while retaining history. |
| No pagination metadata | `page`, `pageSize`, `total`, `totalPages` returned. |
| No sorting | `relevance` (default), `newest`, `oldest`, `title`. |
| No extraction | `worker/extraction/*` with PDF, DOCX, ODT, HTML, JSON, CSV, TXT; see `docs/full-text-extraction.md`. |
| No reindex | `search.reindex` job (item / file / all) plus triggers on content and access changes. |
| No observability | `extraction` and `searchIndex` blocks in the worker health payload. |

### Access model enforced by the RPC

| Layer | Rule |
|---|---|
| Item | `status = 'published'` and (`global`, or `faculty` + matching faculty, or `private` + owner/admin). |
| Item embargo | Hidden unless expired, or the caller is admin or the submitter. |
| File | `PUBLIC`, or `AUTHENTICATED` + signed in, or `FACULTY` + matching faculty, or `RESTRICTED` + admin, or `PRIVATE` + owner/admin. |
| File embargo | Same rule as item embargo. |

Only rows the caller may see are returned, so a private file's text can never reach
an anonymous or unauthorised caller — in results, snippets, match provenance or
facet counts.

### Index weights

```
A  title
B  authors + subjects + keywords
C  abstract
D  extracted file text
```

### Live verification

`scripts/e2e-search-live.ts` runs the real extraction → index → search path against
the hosted project and proves that a private-only term is not searchable
anonymously but is searchable by the owner. 24/24 checks pass.