# AIP Format Specification

The archival information package is a **BagIt 1.0** bundle. The implementation
lives in `src/server/preservation/aipBundle.ts` (build and validate) and
`src/server/preservation/aipExport.ts` (export orchestration).

## Layout

```
<bag-name>/
├── bagit.txt
├── bag-info.txt
├── manifest-sha256.txt
├── tagmanifest-sha256.txt
├── metadata/
│   ├── descriptive.json
│   ├── administrative.json
│   ├── rights.json
│   ├── provenance.json
│   └── versions.json
└── data/
    └── files/
        └── <sanitized original filename>
```

Payloads are placed under `data/` and never at the bag root. Every payload path
is passed through `sanitizePayloadPath`, which strips leading separators, removes
`..` segments and rejects absolute paths, so a malicious filename cannot escape
the bag.

## bagit.txt

```
BagIt-Version: 1.0
Tag-File-Character-Encoding: UTF-8
```

## bag-info.txt

```
Bagging-Date: <ISO 8601>
Bag-Software: ESUT SMART LIBRARY preservation service
Payload-Oxum: <payload byte count>.<payload file count>
External-Identifier: <repository item id>
```

`Payload-Oxum` is computed from the bytes actually written, not from the
database `file_size`, so the tag always matches the payload.

## manifest-sha256.txt

One line per payload, relative to the bag root:

```
<sha256 hex>  data/files/<name>
```

Only files under `data/` are listed. The manifest is the integrity contract of
the bag: `validateAIP` recomputes every payload checksum and compares it to the
manifest, and separately compares the manifest to the database checksums at
export time.

## tagmanifest-sha256.txt

SHA-256 of `bagit.txt`, `bag-info.txt` and `manifest-sha256.txt`.

## metadata/

| File | Contents |
|---|---|
| `descriptive.json` | Title, authors, contributors, abstract, type, identifiers, dates. |
| `administrative.json` | Tenant, item id, visibility, status, access level, storage provider/bucket. |
| `rights.json` | Access level, licence, embargo. |
| `provenance.json` | Export actor, export time, source storage location, checksum algorithm, handling policy. |
| `versions.json` | Version list with change notes and per-version file lists. |

Metadata is written for humans and for future restore tooling. It must never
contain credentials. `validateAIP` walks every metadata JSON document and fails
the bag if any **key** matches
`/(password|passwd|secret|token|api[-_]?key|private[-_]?key|credential|authorization|signature)/i`.
Values are not scanned, so a policy statement may describe the rule in prose.

## Export selectors

`exportItemAIP(itemId, userId, { versionId?, bagName? })` resolves the payload
set with `resolveVersionFiles`:

| Selector | Files included |
|---|---|
| `version-tag` | Only files tagged to the requested version. |
| `version-snapshot` | The item's files as they were at that version. |
| `all-files` (default) | Every file attached to the item. |

If a version is requested but has no tagged files, the export falls back to an
as-of snapshot and reports `warning` in the result.

## Export integrity rules

- A file whose stored checksum does not match its expected checksum is **skipped**
  and reported in `warnings`; it is never written into the bag.
- The bag is validated **before** anything is written to `aip-exports`. A bag
  that fails validation is not persisted, and the failure is recorded as an
  `AIP_VALIDATED` event with `valid: false, exported: false`.
- On success, `AIP_EXPORTED` and `AIP_VALIDATED` events are recorded with the
  manifest checksum, payload count and selector.

## Validation

`validateAIP(bundle)` returns `{ valid, errors[], warnings[] }` and checks:

1. `bagit.txt` exists and declares `BagIt-Version`.
2. `bag-info.txt` parses and `Payload-Oxum` matches the payload.
3. `manifest-sha256.txt` parses and every listed payload exists with a matching
   checksum.
4. No payload path escapes `data/` or contains `..`.
5. Every metadata document is well-formed JSON.
6. No metadata key matches the secret-key pattern.
7. No signed-URL material (`X-Amz-Signature`, `token=…`, `sig=…`) anywhere in
   metadata.

## Storage

AIPs are written to the `aip-exports` bucket under
`aip/<itemId>/<bagName>/`. Objects are written with `writeStoredObject`, which
uses the active provider (Supabase today).
