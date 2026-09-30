# Repository File Model Audit — ESUT Smart Library

Date: 2026-09-30 · Session: REPAIR SESSION 1 · BATCH 5

## Current Architecture

Repository items use a single `file_url` column on `repository_items` table. This prevents:
- Multi-file deposits (thesis + appendix + dataset)
- File-level permissions and embargoes
- Per-file preservation and fixity
- SWORD deposits
- Version-aware files
- Proper AIP packaging

## file_url Usage Inventory

| File | Line | Usage | Classification |
|---|---|---|---|
| `src/lib/supabase.ts` | 80 | Type definition | MUST MIGRATE |
| `src/app-pages/RepositoryItem.tsx` | 60 | Read from API | MUST MIGRATE |
| `src/app-pages/RepositoryItem.tsx` | 139-140 | Open file in new tab | READ |
| `src/app-pages/RepositoryItem.tsx` | 340-346 | Display file link | READ |
| `src/app-pages/RepositoryItem.tsx` | 437-454 | PDF/image preview | READ |
| `src/app-pages/RepositoryItem.tsx` | 526-527 | Version file link | READ |
| `src/app-pages/RepositorySubmit.tsx` | 216 | Write on submit | WRITE |
| `src/app-pages/RepositorySubmit.tsx` | 234 | Version creation | WRITE |
| `src/app-pages/ThesisSubmit.tsx` | 144 | Write on submit | WRITE |
| `src/app-pages/ThesisSubmit.tsx` | 165-188 | Upload + write | WRITE |

## Target Architecture

New `repository_files` table with:
- `id`, `repository_item_id`, `storage_provider`, `storage_bucket`, `storage_key`
- `original_filename`, `mime_type`, `file_size`, `checksum`
- `role` (ORIGINAL, SUPPLEMENTARY, THUMBNAIL, TEXT, LICENSE, METADATA)
- `access_level`, `embargo_until`, `display_order`
- `uploader_id`, `created_at`, `updated_at`

## Migration Plan

1. Create `repository_files` table
2. Backfill existing `file_url` values
3. Update API routes to use new table
4. Update UI to support multiple files
5. Deprecate `file_url` (keep for compatibility)
