# 08 — T10: Digital Preservation (Phase 22, §7)

## Architecture audit (§7 first step)

Storage layout: Supabase Storage buckets for deposited files, DB rows (`repo_items`, item versions) for metadata, with `publicPdfUrl` for public links (known pre-existing quirk: rejects `http` URLs — documented). File references are stable UUIDs (canonical `/repository/<uuid>`), satisfying "stable file references".

## Implemented / completed

| Requirement | Implementation |
|---|---|
| File checksum verification | `src/server/preservation/` fixity logic (earlier in-phase) |
| Scheduled fixity checks | worker-based preservation job (`worker/preservation/`) |
| Missing-file detection / corruption alerts | preservation error reporting surfaces in preservation module |
| File version tracking | `item_versions` + `src/server/repository/versions.test.ts` (green) |
| Backup-status monitoring | `src/server/preservation/backups.ts` + `backups.test.ts` |
| Preservation metadata | preservation migration `20261022090000_preservation_backups_retention.sql` (+ rollback `…down.sql`) |
| Recovery documentation | `13_DEPLOYMENT_ROLLBACK_PLAN.md` (prior phase) + this deliverable's procedure below |
| Safe restoration tests | non-destructive export/verification path: `app/api/preservation/export/` + retention rules |
| Storage error reporting | preservation module error paths |
| Retention controls | `src/server/preservation/retention.ts` + `retention.test.ts` |

## Backup reliability — not assumed (§7 explicit warning)

The brief warns: "Do not assume a backup is reliable merely because backup jobs exist." This phase does **not** claim backup reliability from job existence alone: backups monitoring reports *status*, and the actual **restoration exercise could not be performed** — see BLOCKED below.

## Documented restoration procedure (provided because verification is BLOCKED)

1. Identify restore point: backup timestamp ≤ desired time; verify its manifest/checksum report is green in backup-status monitoring.
2. Create an isolated restore target (separate Supabase project or cloned bucket + DB snapshot) — never production.
3. Restore bucket objects first (preservation export lists expected object keys + checksums via `app/api/preservation/export/`).
4. Restore DB snapshot; point a staging deployment at it with staging env vars.
5. Verify: run fixity check job against restored objects; compare checksum manifest; spot-check N public records (download + PDF link + versions history).
6. Record results; only then promote the backup's "restorable" status.

## BLOCKED: documented restoration exercise (§7's explicit allowance)

- **BLOCKED** — no authorized nonproduction environment holding a real production backup artifact was available this phase. Supabase local stack attempts were made (see 03; config-level obstacles encountered); no real backup exists to restore regardless.
- Per §7: "If infrastructure access is unavailable, provide exact procedures and mark restoration verification as **BLOCKED**." → Restoration verification: **BLOCKED** (procedure above).

## Resolved problems

- Backup/retention/preservation logic added with dedicated tests (2 new suites, green in final run).
- Preservation migration + rollback both present for review before any application.

## Remaining issues / unverified

- Restoration exercise: BLOCKED (above).
- Fixity cadence against production files: unverified (no production writes allowed).
- Migration `20261022090000` not applied to production (owner-gated; reviewed with rollback present).

## Verification results

`backups.test.ts` + `retention.test.ts` green in final full run (115 files / 1003 tests, exit 0); `tsc` 0; ESLint 0; build 0.
