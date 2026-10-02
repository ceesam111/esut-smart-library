# Full-Text Extraction

Batch 8 added asynchronous full-text extraction for repository files. This document
covers the pipeline, supported formats, security limits and operational behaviour.

## Pipeline

```
file uploaded
  → repository_files.extracted_text_status = 'PENDING'
  → repository.extractText job enqueued (worker)
  → bytes read through the cache-busting object store
  → MIME verified, text extracted in a sandboxed worker thread
  → extracted_text / extracted_at / extraction_duration_ms written
  → search.reindex job enqueued
  → repository_search_documents rebuilt for the item
  → access-aware search returns the item
```

Upload never waits for parsing. Extraction runs in the worker process.

## Statuses

| Status | Meaning | Retried? |
|---|---|---|
| `PENDING` | Not yet extracted. | When a job runs. |
| `PROCESSING` | Extraction in flight. | Yes, if the job dies. |
| `COMPLETE` | Text stored and |
| `FAILED` | Extraction threw or the parser rejected the file. | Yes, up to `max_attempts`. |
| `NOT_SUPPORTED` | MIME type is not supported. | No — permanent. |
| `NO_TEXT_LAYER` | The document has no extractable text (image-only PDF, blank document). | No — unless OCR is configured. |
| `BLOCKED_EXTERNAL` | No text layer and no OCR engine configured. | When OCR is configured. |

`FAILED` from a transient cause (timeout, worker error, OCR service error) is
retried. `FAILED` from a permanent cause (corrupt file, encrypted PDF, oversized)
is not retried endlessly — `max_attempts` (default 3) bounds every job.

## Supported formats

| MIME | Library | Notes |
|---|---|---|
| `text/plain`, `text/csv` | built-in | Decoded as UTF-8, control characters stripped. |
| `application/json` | built-in | String values are collected and indexed. |
| `text/html` | built-in | Script/style blocks removed, entities decoded. |
| `application/pdf` | `pdf-parse` 2.4.5 (pdfjs-dist 5.4) | Embedded text layer, page limits, `NO_TEXT_LAYER` detection. |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `mammoth` 1.13 + `jszip` | Paragraphs, headings, table cells. |
| `application/vnd.oasis.opendocument.text` | `jszip` + built-in XML reader | Paragraphs, headings, table cells. |

`application/msword` (legacy DOC) is deliberately **not** supported: it cannot be
parsed reliably without executing active content. DOCM and other macro-bearing
formats are rejected.

## PDF handling

- Text is extracted from the embedded text layer only. No OCR by default.
- Reading order follows the library's text-run order; `lineEnforce` restores line breaks.
- Whitespace is normalised and control characters are stripped.
- A PDF whose normalised text is under 20 characters is reported as `NO_TEXT_LAYER`,
  **not** as a successful empty extraction.
- Encrypted or password-protected PDFs fail with `PERMANENT_ERROR`.
- Malformed PDFs fail safely; the worker never crashes.

## DOCX / ODT handling

- The ZIP container is opened with CRC verification and an entry-count limit.
- Decompressed body size is capped.
- Headings are marked with `## ` so they remain identifiable in the index.
- Table cells are joined with ` | ` per row.
- Macros and embedded objects are never executed.

## Security limits

| Limit | Default | Override |
|---|---|---|
| Maximum file size | 50 MB | `EXTRACTION_MAX_FILE_BYTES` |
| Maximum PDF pages | 500 | `EXTRACTION_MAX_PAGES` |
| Maximum indexed characters | 2 000 000 | `EXTRACTION_MAX_TEXT_CHARS` |
| Extraction timeout | 120 s | `EXTRACTION_TIMEOUT_MS` |
| DOCX/ODT entries | 5 000 | — |
| Decompressed DOCX/ODT body | 20 MB | — |
| OCR input | 25 MB | — |

### Worker isolation

`pdfjs-dist` blocks the main event loop while parsing, which makes a wall-clock
timeout on the main thread useless. Extraction therefore runs inside a
`node:worker_threads` sandbox (`worker/extraction/sandbox.ts`):

- The main thread stays responsive, so the timeout fires on time.
- On timeout the worker is **terminated**, so a hanging parser cannot wedge the worker.
- The worker entry imports the engine lazily; a static import of `pdfjs-dist` at
  module load hangs inside a worker thread.

## OCR

OCR is an **optional adapter** (`worker/extraction/ocr.ts`). It is never required.

| `OCR_PROVIDER` | Engine |
|---|---|
| unset / `none` | No OCR. `NO_TEXT_LAYER` becomes `BLOCKED_EXTERNAL`. |
| `tesseract` | Local `tesseract` binary (`OCR_TESSERACT_CMD`, `OCR_TESSERACT_LANG`). |
| `http` | HTTP service (`OCR_HTTP_ENDPOINT`, optional `OCR_HTTP_API_KEY`). |

When OCR is configured and a document has `NO_TEXT_LAYER`, the worker runs OCR and
stores the result with `ocr_status = 'APPLIED'`. OCR output is never faked.

## Storage reads

Extraction reads bytes through `readStoredObject`
(`src/server/preservation/objectStore.ts`), which uses a short-lived signed URL with
`cache: 'no-store'`. A plain `storage.download()` is **not** used because Supabase
serves `/object/` with `cache-control: public, max-age=3600` and would return stale
bytes for up to an hour after an overwrite or delete.

## Observability

`worker/health.ts` reports an `extraction` block with counts per status
(`pending`, `processing`, `complete`, `failed`, `notSupported`, `noTextLayer`,
`blockedExternal`) and `lastRunAt`. A `searchIndex` block reports
`pendingReindexJobs`, `documents` and `lastReindexAt`.

## Manual extraction

`POST /api/repository/files/[id]/extract` (library admin) runs extraction on demand
and returns the resulting status. `POST /api/repository/reindex` rebuilds the search
index for one item, one file, or the whole repository.
