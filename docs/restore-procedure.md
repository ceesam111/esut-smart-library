# Restore Procedure

Restore materialises an AIP back into the repository. Implementation:
`src/server/preservation/restore.ts`, route `app/api/preservation/restore/route.ts`.

## Safety model

Restore is **fail-closed**. Every guard below must pass before a single row is
written.

| Guard | Behaviour on failure |
|---|---|
| Target allow-list | `RESTORE_TARGETS = ['isolated', 'test', 'staging']`. Anything else — including `production` — is rejected before preflight. |
| AIP exists | The `aip-exports` objects must be listed and downloadable. |
| Structural preflight | `preflightRestore` re-runs the full `validateAIP` check plus traversal and checksum verification. |
| Path safety | `findUnsafePaths` rejects any payload path containing `..`, a leading separator, or an absolute path. |
| Metadata safety | Malformed metadata JSON aborts the restore. |
| Checksum agreement | Every payload checksum must agree with its manifest entry. |

Preflight runs **before** the run row leaves `pending`, so a rejected restore
never becomes a half-applied item.

## Targets

| Target | Meaning |
|---|---|
| `isolated` | Restored into a private, non-published item. This is the default and the only target that should be used operationally. |
| `test` | Same isolation, labelled for drill purposes. |
| `staging` | Same isolation, labelled for staging drills. |

`production` is not a target. There is no code path that restores an AIP over a
live item.

## Run lifecycle

`restore_runs.status` follows `pending → running → validated → complete | failed`.

1. `pending` — run row created with the AIP path, target and actor.
2. `running` — `RESTORE_STARTED` event recorded; payloads downloaded.
3. `validated` — preflight passed; checksums verified.
4. `complete` — new item and file rows written; `RESTORED` event recorded with
   the new item id, file count and differences.
5. `failed` — `RESTORE_FAILED` event recorded with the reason. No partial item
   is left behind.

## What gets created

- A new `repository_items` row with `visibility = 'private'` and
  `status = 'review'`. The restored item is never published and never inherits
  the source item's visibility.
- New `repository_files` rows whose checksums are the **verified manifest
  checksums**, stored under `restored/<runId>/…` in the active bucket.
- A `metadata/provenance.json` entry recording the source AIP, the run id, the
  target and the restore time.
- `differences` in the run row listing any payload that was skipped.

## Operator steps

1. Confirm the AIP exists and validates:
   `GET /api/preservation/restore` lists runs; the AIP path is in the run record.
2. Restore into `isolated`:
   `POST /api/preservation/restore` with `{ "aipPath": "...", "target": "isolated" }`.
3. Check the run reaches `complete` and note the `restoredItemId`.
4. Review the restored item in the repository dashboard. It is private and in
   `review`, so it is invisible to readers until a librarian publishes it.
5. Delete the AIP from `aip-exports` when it is no longer needed.

## Live evidence

`scripts/e2e-aip-live.ts` performs the full round trip against the hosted
project — export, download, re-validate, isolated restore, target-guard
rejection — and removes every fixture it creates. 41/41 checks pass.

## Known limitations

- Restore creates a new item; it never updates or replaces an existing item.
- Format-level validation (whether a PDF still renders) is out of scope; restore
  verifies bytes and structure only.
- A restore run that fails after the item row is written is not automatically
  rolled back; the run row records `failed` and the operator removes the
  partial item.
