# SLAAS Reuse Matrix

Smart Library Access & Analytics System (SLAAS) — integration plan proving this is a first-class module inside the existing ESUT Smart Library Platform, not a competing subsystem.

Generated during the FINAL AUTONOMOUS COMPLETION RUN (`next-prompt.md`).

## Non-negotiable constraints honored by this design

| Constraint | How this design honors it |
|---|---|
| No second standalone app | All SLAAS code lives in the existing Next.js App Router tree (`app/api/access/*`, `app/pages/access/*`). No new deployable, no second `package.json`. |
| No competing auth / user system | SLAAS authenticates with the existing Bearer session (`requireUser` / `requireRole`). Patrons are resolved from the existing `patrons` table (`user_id`). No new password store, no new JWT issuer. |
| Not a replacement ILS | SLAAS records occupancy, visits, and gate events only. Loans, holds, renewals, fines remain in `loans`, `fines`, catalogue. SLAAS reads `loans` for the "currently borrowing" enrichment, never writes it. |
| No duplicated functionality | Identity (QR) reuses `patrons.patron_id` / `patrons.library_number`. Analytics reuses `analytics_events` taxonomy + `eventCapture` pipeline. Reports reuse `reportBuilder` + `buildXlsx`. Audit reuses `writeAuditLog`. |
| Existing identity, roles, tenant | `requireRole` + `user_roles` + `resolveTenant`. SLAAS defines no new roles; it maps officer permissions onto existing `LIBRARY_ADMIN_ROLES` / `GLOBAL_ADMIN_ROLES` / department IR officers. |
| Existing academic structures | Branch ↔ faculty mapping reuses `config/institution.config` (`institutionConfig.branchLibraries` / `facultyLibraries`). Faculty/department metadata on events reuses `analytics_events.faculty` / `.department`. |
| i18n, a11y, observability, backups, deployment | Every new string is en+fr via `t()`. Pages follow 17C accessibility baseline. Server code uses the existing childLogger + requestId. New tables are included in the same backup/DR path (see PART VII). |

## Capability → existing system → integration decision

| # | SLAAS capability | Existing system / file | Integration decision |
|---|---|---|---|
| 1 | Authentication | `src/server/auth/requireUser.ts`, `requireRole.ts`, `permissions.ts` | Reuse verbatim. All `/api/access/*` routes call `requireUser`/`requireRole`. SLAAS adds zero auth primitives. |
| 2 | Role model | `src/server/auth/permissions.ts` (`LIBRARY_ADMIN_ROLES`, `GLOBAL_ADMIN_ROLES`, `hasAnyRole`) | Reuse. Officer = `LIBRARY_ADMIN_ROLES` or dept IR officer. Admin config = `GLOBAL_ADMIN_ROLES`. Manual corrections restricted to `LIBRARY_ADMIN_ROLES`. |
| 3 | Patron identity | `patrons` table (`id`, `user_id`, `patron_id`, `library_number`, `full_name`, `patron_category`, `faculty_code`, `department`, `status`) | Reuse. SLAAS `access_identities` is a thin 1:1 child keyed to `patrons.id`; never a duplicate identity store. |
| 4 | QR library card | `src/app-pages/dashboard/LibraryCard.tsx` (qrcode.react, cardCode = `library_number \|\| patron_id`) | Reuse cardCode as the stable public identifier. SLAAS encodes a scoped access token (see §6); no new PII in the QR. |
| 5 | Tenant | `src/server/tenant/resolveTenant.ts` (DEFAULT_TENANT_ID) | Reuse for multi-tenancy. New tables carry `tenant_id` defaulting to the same constant. |
| 6 | Audit | `src/server/audit/writeAuditLog.ts` | Reuse. Every SLAAS manual op, correction, visitor issue, config change, and (sampled) scan outcome writes an audit row. |
| 7 | Analytics taxonomy | `analytics_events` + `event_capture`/`eventRecorder` + migration `20261003110000_analytics_events_full.sql` | Reuse. SLAAS emits `library_visit`, `library_gate` events into the same table (extend the CHECK constraint) so the existing admin analytics and reports pick them up automatically. |
| 8 | Reports / export | `src/server/reports/reportBuilder.ts`, `xlsx.ts` (`buildXlsx`), `reportWriter.ts`, `csv.ts` | Reuse. SLAAS occupancy/visit datasets register as a new `ReportDataset` with CSV + real XLSX export (no ad-hoc exporter). |
| 9 | API conventions | `src/server/api/withHandler.ts`, `errors.ts`, `responses.ts` | Reuse for new routes so zod validation, requestId, and error shapes stay consistent. |
| 10 | Logging / observability | `childLogger` in `withHandler` (requestId) | Reuse. SLAAS server modules log through the request-scoped child logger. |
| 11 | Academic / branch config | `config/institution.config` (`branchLibraries`, `facultyLibraries`, `libraryMode`) | Reuse as the source of truth for the branch catalogue. SLAAS `branches` seeds from it; capacity overrides stored in a new config table. |
| 12 | Idempotency precedent | `offline_circulation` + `20261004320000_offline_circ_idempotency.sql` (unique `client_txn_id`) | Reuse the unique-constraint idempotency pattern for scan events and visitor pass redemption. |
| 13 | Workflow / notifications | workflow engine, notice/delivery tables | Reuse for visitor-pass expiry and capacity-threshold notices. |
| 14 | SIP2 / worker | `sip2/`, `worker/` | Not duplicated. SLAAS gate events are separate; if offline scanning is needed later it reuses the offline-workstation mechanism. |
| 15 | E2E harness | `scripts/e2e-*.ts`, Playwright `channel:'chrome'` | Reuse for the four required SLAAS journeys. |
| 16 | a11y / i18n gates | 17C baseline `e2e-a11y-live.ts`, `src/lib/a11y.test.tsx` | Reuse unchanged; SLAAS pages added to the route list. |

## Deliberately NOT reused (and why)

| Tempting reuse | Decision | Reason |
|---|---|---|
| Store emails / names / matric numbers in SLAAS QR | **Rejected** | Prompt forbids unnecessary PII in the credential. QR carries a scoped token referencing `access_identities.id` only. |
| Separate occupancy counters table as sole source | **Rejected** | Occupancy is always derived from `library_visits` (checked-in minus checked-out) so it cannot silently drift; the counter is a cached projection only. |
| A standalone "SLAAS users" table | **Rejected** | Would create a competing user system; patrons come from `patrons`. |
| Leaderboards ranking individuals | **Rejected** | Privacy: aggregate/cohort-only analytics, small-cohort suppression. |
| New export library (xlsx-populate etc.) | **Rejected** | `buildXlsx` already produces genuine OOXML with formula-injection neutralization. |

## Open decisions resolved in favor of the prompt's defaults

- **Duplicate scan strategy:** idempotent within a debounce window (no silent new visit on repeated scan).
- **Occupancy:** derived; cached projection refreshed on each gate event.
- **Incomplete visit:** auto-close after a configurable max-duration; never silently deleted.
- **Visitor temporary pass:** signed, expiring, single-branch, redeem-once, fully audited.

---

*This matrix is the design authority for the SLAAS build. Any new table or route must map to a row above.*
