# SLAAS — DPIA Technical Input

Status: engineering input for the institution's Data Protection Impact Assessment.
Date: 2026-10-10 (post next@16.4.0 upgrade)

**This document does not constitute a completed legal DPIA.** It records how the
Student Library Access & Attendance System (SLAAS) processes personal data so the
institution's Data Protection Officer can complete the assessment required under
the Nigeria Data Protection Act (NDPA) 2023. No legal certification is claimed.

## 1. Data categories

| Category | Examples | Identifiable? |
|---|---|---|
| Staff/faculty identities | name, staff number, department, email, role, credential hash | yes |
| Student identities | name, matric number, programme/level, email, role, credential hash | yes |
| Visitor identities | name, phone, affiliation, issued QR pass credential | yes |
| Attendance events | branch, check-in/check-out timestamps, duration, method (scan/manual), operator | yes, linked to identity |
| Occupancy analytics | per-branch counts, hourly/weekday aggregates, unique-user totals | aggregate only |
| Audit/security logs | actor id, action, target, timestamp, request id | pseudonymous (user id) |
| Notifications | in-app receipts (checkout/check-in), notice delivery log | yes, linked to account |
| Corrections | visit correction records (actor, reason, before/after) | yes, linked to identity |

QR credential payloads contain an opaque identity UUID, issuer/audience, validity
window and nonce only — no names, numbers or contact details are encoded in the
code itself (see `src/server/slaas/qr.ts`).

## 2. Purpose

- Record physical entry/exit of library users at access gates (attendance).
- Maintain real-time branch occupancy against per-branch capacity.
- Produce attendance statistics for library reporting.
- Support data-subject visibility of one's own visit history and export.

Purpose limitation is enforced by API authorization: student/visitor sessions can
only read their own visits; aggregate dashboards are restricted to privileged staff.

## 3. Flows

1. QR scan at gate → `POST /api/access/scan` → HMAC credential verification →
   identity/visitor lookup → visit open/close write → event log → occupancy recount.
2. Manual check-in/out by circulation staff (same server path, operator recorded).
3. Corrections by privileged staff (reason required, audited).
4. Dashboard queries (occupancy, analytics, history) and CSV export (staff only).
5. Self-service visit history for the authenticated data subject.

## 4. Storage

- Primary store: hosted Supabase (PostgreSQL) — remote cloud database.
- Application: institution-operated Next.js server; secrets in `.env.local` (not in Git).
- Backups: local snapshot files produced by `scripts/backup-restore-slaas-live.mjs`
  during DR tests (contains personal data while present; test artifacts are local,
  untracked, and removed after verification).
- Logs: application logs record request ids and error codes; password/credential
  values are never logged (verified by privacy red-team, `docs/audit/slaas-privacy-red-team.md`).

## 5. Access control

- Role-based authorization on every API (verified: anonymous → 401 clean; student
  → 403 with no cross-tenant leakage; invalid ids → 404 with no existence leak).
- Privileged roles (super admin / librarian / circulation officer tiers) can view
  identifiable registers and run exports; ordinary accounts cannot.
- Passwords hashed (bcrypt); QR secrets server-side only (`SLAAS_QR_SECRET`
  required in production).
- Zod schemas reject mass assignment on write endpoints.

## 6. Retention

- Platform privacy notice (`/privacy`) publishes retention periods for library
  data categories and NDPA rights (section 4–5 of that page).
- SLAAS attendance rows currently have **no automated pruning job**: visit
  records persist until an administrator deletes them. Configurable retention
  architecture with safe (audited, non-destructive by default) execution is a
  recorded gap, not an accident of design — see `docs/audit/part-xliv-gap-audit.md`.
- Aggregate analytics are identifier-free and may be retained indefinitely.

## 7. Risks (identified)

1. Re-identification from attendance patterns in small cohorts (e.g. a single
   department) when combined with dashboards. *Assessment: accepted P2 — detailed
   registers were already visible to the same privileged roles pre-SLAAS;
   k-anonymity suppression on small aggregates would be security theater here.*
2. Brute-force scanning of predictable QR codes. *Mitigated: HMAC-signed
   credentials, scan debounce, idempotency; rate limiting on `/api/access/*` is an
   accepted residual risk in dev (documented; add middleware sensitive-prefix +
   Arcjet in production).*
3. Insider misuse of identifiable registers. *Mitigated: audit logs on scan,
   correction and export actions with actor + request id.*
4. Export over-exposure. *Mitigated: authenticated staff-only CSV, hard row cap
   (`MAX_EXPORT_ROWS = 5000`), identifier hygiene verified by automated probes.*
5. Credential leakage from repositories. *Mitigated: secrets scan
   (`npm run scan:secrets`) runs over all tracked files with 0 findings; no
   upstream provider secrets stored in project files.*

## 8. Safeguards

- Envelope error handling never leaks internals (404/403/500 probes pass).
- Concurrent burst check-ins/check-outs converge with zero lost updates
  (load test: 12-parallel bursts, all 200, final occupancy 0).
- DR test proves recoverability (29/29, loss-to-verified ≈ 42 s on fixture data).
- Full privacy red-team evidence: `docs/audit/slaas-privacy-red-team.md` (15/15).

## 9. Vendors / processors

| Vendor | Role | Data involved |
|---|---|---|
| Supabase (hosted) | PostgreSQL storage | all SLAAS tables |
| Institution server | runs Next.js app | request handling, secrets |
| (optional) Arcjet | abuse protection when configured | IP/request metadata |

No payment, advertising or third-party analytics processors are used by SLAAS.

## 10. QR architecture

- Static credential: signed claims with long expiry for issued identities;
  dynamic credential: short TTL + nonce for temporary passes.
- Server verifies signature, version, audience and expiry before any lookup;
  token hashes stored for revocation support.
- Visitor passes are single credential records revocable by staff.

## 11. Analytics

- Aggregates only: totals, unique users, per-branch, per-hour, per-weekday.
- Privacy probe verified no identifiers in analytics responses; cohort-size
  concerns documented in §7.

## 12. Exports

- Staff-authenticated CSV of visits; columns deliberately exclude credential
  material and contact fields; hard row cap 5000; export actions audited.

## Evidence index

- Privacy red-team: `docs/audit/slaas-privacy-red-team.md` (15/15).
- DR/restore: `docs/audit/slaas-backup-restore-dr.md` (29/29).
- Load/concurrency: `docs/audit/slaas-load-test.md` (0 errors).
- Scanners: `npm run scan:secrets`, `npm run scan:sast` (0 findings).
- Platform privacy notice: `/privacy` (institution-configurable text).
