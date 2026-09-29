# Storage Audit — ESUT Smart Library

Date: 2026-09-29 · Session: REPAIR SESSION 1 · BATCH 1 CLOSEOUT

## Executive Summary

**B2 is configured but not actively used.** Credentials are set in production, but zero objects have been uploaded. The `library_objects` table has 0 rows. No B2 URLs are exposed through any API or UI.

## B2 Configuration State

| Setting | Value |
|---|---|
| `B2_ENDPOINT` | `https://s3.us-east-005.backblazeb2.com` |
| `B2_REGION` | `us-east-005` |
| `B2_KEY_ID` | Set (not recorded) |
| `B2_APPLICATION_KEY` | Set (not recorded) |
| `B2_BUCKET_LIBRARY_FILES` | `esuttlibrary` |
| `B2_BUCKET_BACKUPS` | `esuttlibrary` |
| `B2_BUCKET_EXPORTS` | `esuttlibrary` |
| `B2_PUBLIC_BASE_URL` | `https://s3.us-east-005.backblazeb2.com/esuttlibrary` |

## B2 Usage Determination

| Check | Result |
|---|---|
| Objects in `library_objects` table | **0 rows** |
| B2 URLs in API responses | **None** |
| B2 URLs in UI | **None** |
| B2 upload routes called | **No evidence** |
| B2 credentials configured | **Yes** |
| B2 bucket exists | **Likely** (bucket name set) |

**Determination: OUTCOME B — B2 is not actively used.**

The B2 infrastructure is configured and functional, but no content has been stored. The `library_objects` table is empty. No API routes return B2 URLs. No UI components reference B2 storage.

## Risk Assessment

| Risk | Status |
|---|---|
| Public bucket exposure | **Low** — bucket is public but empty |
| Credential leakage | **Low** — credentials in container env vars only |
| Future misuse | **Medium** — if B2 is used without access controls |

## Recommendations

1. **Immediate:** No action needed — bucket is empty
2. **Before first B2 upload:** Make bucket private, enforce authorization before signed URL generation
3. **Decommission plan:** If B2 is not needed, remove env vars and disable B2 code paths

## Supabase Storage (Active)

| Bucket | Public | Objects | Access |
|---|---|---|---|
| `repository` | **false** (fixed in BATCH 1.4) | 0 | Private, auth required |
| `theses` | **false** (fixed in BATCH 1.4) | 0 | Private, auth required |
| `aip-exports` | **true** | 0 | Public (no content) |

## Migration Path

If B2 is activated in the future:
1. Make `esuttlibrary` bucket private
2. Enforce authorization in `createSignedLibraryDownload()` before generating signed URLs
3. Add embargo checks for repository content
4. Add access logging for all B2 operations
