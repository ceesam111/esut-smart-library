# Test Plan

This plan validates the Smart Library before production and before hosted-to-self-hosted Supabase cutover.

## Test Environments

- Local developer environment with hosted Supabase dev project.
- Hosted Supabase staging project.
- Self-hosted Supabase staging server managed by Coolify.
- App Server staging deployment with Next.js app and worker containers.
- Backblaze B2 staging buckets.

## Required Automated Tests

Run on every release candidate:

```bash
npm run test
npm run build
```

## Security And Tenant Tests

| Test | Steps | Expected Result |
| --- | --- | --- |
| Cross-tenant candidates blocked | Create Tenant A and Tenant B admins. Insert `resource_candidates` rows for both. Query as Tenant A through anon/authenticated client. | Tenant A sees only Tenant A rows. Tenant B rows are invisible. |
| Cross-tenant B2 metadata blocked | Insert `library_objects` rows for both tenants. Query as Tenant A patron/admin. | Tenant A cannot read Tenant B object metadata. |
| Cross-tenant agent jobs blocked | Insert `agent_jobs` for two tenants. Query as Tenant A admin. | Tenant A sees only Tenant A jobs. |
| Role escalation blocked | Login as patron/student and call admin APIs such as `/api/admin/harvest`. | Request returns 401/403. No row created or changed. |
| Service role absent from browser | Inspect built JS and runtime env exposed to browser. | No `SUPABASE_SERVICE_ROLE_KEY`, B2 key, AI key, DB password, or Resend key present. |
| Approval bypass blocked | Attempt to update `resource_candidates.status='approved'` directly as non-admin. | RLS blocks update. |
| Worker lock duplicate prevention | Run two worker containers with same pending job. | Only one worker claims and completes the job. |

## CSV Catalogue Import

| Test | Steps | Expected Result |
| --- | --- | --- |
| Valid CSV stages rows | Upload valid catalogue CSV. | Batch created, staging rows pending/clean match. No live catalogue write yet. |
| Invalid CSV shows validation errors | Missing title/ISBN or malformed year. | Row is staged with validation error or rejected from staging according to rules. |
| Duplicate ISBN detected | Upload ISBN already in live catalogue. | Candidate/staging row marked duplicate/conflict and cannot auto-promote. |
| Approval promotes row | Admin approves clean staging row. | `catalogue_items` row created, staging row status approved, audit log written. |
| Rejection records reason | Admin rejects staging row. | Status rejected, reason saved, audit log written. |

## CSV Patron Import

| Test | Steps | Expected Result |
| --- | --- | --- |
| Patron CSV validation | Upload batch with valid and invalid patron rows. | Invalid rows are flagged; valid rows require approval. |
| Duplicate patron blocked | Import existing matric/staff/library ID. | Duplicate flagged; no duplicate patron account created. |
| Batch approval requires admin | Try approve as patron, then as librarian/admin. | Patron blocked; authorized role succeeds. |
| PII not sent to AI | Instrument AI client while patron import runs. | No patron enrolment payload is sent to AI. |

## Barcode Scanner

| Test | Steps | Expected Result |
| --- | --- | --- |
| Camera scan | Scan ISBN/EAN barcode on Android Chrome. | ISBN is classified and staged. |
| iOS video attributes | Inspect mobile scanner video element on iOS Safari. | Uses iOS-safe inline playback/camera settings and does not force fullscreen. |
| Manual fallback | Disable camera permission and enter barcode manually. | Manual stage works. |
| Offline queue | Simulate offline state and scan/manual entry. | Queue persists locally and syncs later. |

## Auto Resource Harvest And Search Discovery

| Test | Steps | Expected Result |
| --- | --- | --- |
| Local result avoids external APIs | Search exact existing local catalogue title. | Local result returned; external adapters not called. |
| Search miss offers external lookup | Search missing title. | UI offers external search; no external call until user expands. |
| External lookup stages candidate | Run expanded search with known open-access item. | Candidate stored in `resource_candidates`, discovery log written. |
| Duplicate external resource blocked | Search resource already in catalogue/candidates. | Duplicate marked and not published again. |
| Approved candidate becomes local | Approve candidate and repeat search. | Local result appears without external lookup. |
| Unclear rights metadata-only | Candidate has unclear rights and download URL. | Download URL cleared/skipped; status needs review. |
| Legal file queues B2 download | Candidate has clear open/public-domain rights. | Worker job descriptor or `agent_jobs` row is queued for B2 download. |
| Source failure graceful | Simulate one adapter failure. | Other sources continue; local search still works; error logged. |
| Rate limits enforced | Repeated external lookups by same user/tenant. | Later requests return 429 or are blocked by policy. |

## B2 Storage

| Test | Steps | Expected Result |
| --- | --- | --- |
| Signed upload URL | Admin requests upload URL. | URL returned; B2 key not exposed; metadata row created after upload. |
| Signed download URL | Authorized user requests private object. | Short-lived signed URL returned. |
| Unauthorized object access | Tenant A requests Tenant B object. | Request denied. |
| Public object access | Mark object public intentionally. | Public metadata can be read; private objects remain protected. |

## AI Gateway

| Test | Steps | Expected Result |
| --- | --- | --- |
| Block patron PII | Attempt AI purpose `patron_bulk_enrolment` or raw patron PII payload. | AI policy blocks purpose and/or redacts PII. |
| Log AI usage | Run allowed AI Brain task. | `agent_runs` and `tenant_ai_usage` rows created. |
| Untrusted metadata | Feed harvested metadata containing prompt injection text. | AI ignores embedded instructions and returns schema-valid output only. |
| Approval required | Generate newsletter/accreditation draft. | Draft is staged for review, not published automatically. |

## Worker Jobs

| Test | Steps | Expected Result |
| --- | --- | --- |
| Claim job | Insert pending `system.healthCheck`. | Worker claims, completes, writes `agent_runs` and `audit_logs`. |
| Retry failed job | Insert job with invalid payload. | Job retries until `max_attempts`, then fails. |
| Lock timeout | Kill worker while job running; wait lock timeout. | Another worker can reclaim if attempts remain. |
| Graceful shutdown | Send SIGTERM. | Worker stops polling and finishes active jobs before exit. |
| Health endpoint | Call `/health`. | JSON status returns worker id, active count, processed/failed counts. |

## 3D UI Cards

| Test | Steps | Expected Result |
| --- | --- | --- |
| Keyboard access | Tab through catalogue/search/repository cards. | Links/buttons focus visibly and activate with keyboard. |
| Reduced motion | Enable reduced motion. | Hover transforms are disabled/reduced. |
| Image failure fallback | Broken cover URL. | Deterministic generated cover appears. |
| Mobile layout | Test at 320px, 390px, tablet, desktop. | Grid remains usable with no horizontal overflow. |

## Supabase Cutover Tests

| Test | Steps | Expected Result |
| --- | --- | --- |
| Self-hosted staging smoke | Deploy Supabase to staging server, apply migrations/functions. | App connects, auth works, RLS tests pass. |
| Hosted-to-self-hosted env switch | Change app/worker env to self-hosted URL/keys. | App and worker operate without code changes. |
| Edge Function parity | Deploy required functions to self-hosted Supabase. | Function calls succeed with same behavior. |
| Backup restore drill | Restore hosted dump and B2 metadata/files to staging. | Data integrity verified and app boots against restored database. |
