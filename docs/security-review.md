# Security Review

Review date: 2026-06-26

Scope: ESUT Smart Library app, Supabase migrations/functions, Backblaze B2 integration, Vercel AI Gateway integration, worker runtime, and Coolify multi-server deployment plan.

## Architecture Reviewed

- Coolify Control Server manages deployments and must not host application data.
- App Server runs the Next.js app and Smart Library worker container.
- Supabase is hosted now and later self-hosted on a separate Supabase Server.
- Backblaze B2 stores backups, exports, repository files, and legal open-access files.
- Vercel AI Gateway handles controlled AI calls.
- Database-backed jobs are used before Redis.

## Pass/Fail Table

| Area | Status | Evidence | Required Action |
| --- | --- | --- | --- |
| Multi-server deployment | Partial | Docs and Dockerfiles exist for app and worker; Coolify/Supabase server deployment not completed in codebase. | Complete Coolify app/worker deployment and self-hosted Supabase staging smoke test. |
| Environment variables | Partial | Server-only clients use `SUPABASE_SERVICE_ROLE_KEY`, B2, AI keys from env. Browser env helper still accepts `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. | Ensure browser build never receives service-role or secret values under non-public names. Prefer public-only client env names. |
| Service-role key in browser | Pass with configuration dependency | No frontend service-role usage found. Server routes/worker use service role. | Enforce Coolify/Vercel env separation and secret scanning before release. |
| B2 key in browser | Pass | B2 access is server-side in `src/server/storage/*` and worker. | Keep all B2 keys server-only. |
| AI key in browser | Pass | AI Gateway key is read in server AI client only. | Keep AI keys server-only and rotate if exposed. |
| Database passwords in Git | Partial | No DB password observed in reviewed source, but `.env` contains public Supabase anon values. Full secret scan still required. | Run secret scan and remove any accidental secrets before production. |
| Supabase compatibility | Pass | Uses Supabase migrations, RLS, Edge Functions, REST/RPC, and env-swappable URLs/keys. | Apply migrations to hosted Supabase and later self-hosted instance. |
| RLS policies | Partial | New tables have RLS. Older legacy policies include broad public/authenticated reads in some areas. | Perform table-by-table RLS audit before production. |
| Tenant isolation | Partial | New tenant-owned tables include `tenant_id`; older public content tables may be intentionally global or legacy. | Confirm every tenant-owned table has `tenant_id`, RLS, indexes, and tenant-scoped queries. |
| Role-based access | Partial | Admin API routes use `requireRole`; RLS uses `is_library_admin`. Some older policies rely on legacy JWT role checks. | Replace legacy raw JWT role checks where still active. |
| CSV catalogue import | Pass | Staging tables, validation, approval-only promotion, tests exist. | Add end-to-end RLS tests with real Supabase test project. |
| CSV patron import | Partial | Patron approval routes exist, but full batch import security was not revalidated in this pass. | Test patron import validation, duplicate handling, approval, and PII minimization. |
| Barcode scanner | Pass | Scanner docs, utilities, tests, manual fallback, iOS-safe camera approach exist. | Run device tests on iOS Safari and Android Chrome. |
| Auto resource harvest | Pass with restrictions | External adapters, staging, dedupe, rights policy, logs, admin review exist. | Do not enable auto-publish until policy is approved and tested. |
| B2 storage | Pass with operations dependency | Signed upload/download routes and metadata table exist. | Verify bucket policies, lifecycle, encryption/protection, and restore access. |
| AI Gateway | Pass with legacy risk | New server AI Brain logs and redacts. Older Edge Functions still call external AI Gateway directly. | Review/replace legacy AI functions before launch. |
| Worker jobs | Pass | `agent_jobs`, atomic claim RPC, Dockerfile.worker, health endpoint, retry tests exist. | Deploy as separate Coolify service and test locking with two replicas. |
| 3D UI cards | Pass | Components integrated and build passes. | Run accessibility/browser visual QA. |
| Backups/restore | Partial | B2 backup docs exist. Restore drill not yet executed. | Execute documented restore drill before launch. |
| Logs/monitoring | Partial | `agent_runs`, `audit_logs`, worker health exist. | Add Coolify uptime alerts, log retention, B2 backup alerts, Supabase DB monitoring. |
| Disaster recovery | Partial | Runbook/docs now exist. No live drill evidence. | Complete DR simulation and record RTO/RPO. |
| NDPA privacy expectations | Partial | PII redaction for AI, approval queues, audit logs exist. | Publish privacy notice, retention schedule, DSR process, and breach workflow. |

## Required Fixes Before Production

- Apply all local migrations to hosted Supabase and verify they apply cleanly on a self-hosted Supabase staging instance.
- Complete a table-by-table RLS audit, especially older legacy tables and policies that use broad `using (true)` or raw JWT role checks.
- Ensure frontend builds only receive `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; do not assign service-role values to `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, B2, AI, DB, or Resend secrets in browser-accessible environments.
- Keep Supabase Edge Function AI secrets aligned with the Vercel AI Gateway-compatible envs: `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, and model variables.
- Protect Coolify with HTTPS, strong admin credentials, MFA if available, and restricted admin access.
- Protect Supabase Studio; do not expose it publicly without authentication, HTTPS, and IP restrictions or VPN.
- Ensure Postgres is not publicly exposed. If temporary exposure is unavoidable, restrict by firewall to admin IPs and remove after migration.
- Execute backup restore drill and record evidence.
- Run secret scanning across repository and deployment environment exports.
- Verify patron import and batch approval flows do not expose or auto-approve PII incorrectly.
- Confirm approval gates cannot be bypassed through direct API calls, worker jobs, or RLS gaps.

## Recommended Fixes After Launch

- Add automated RLS regression tests against a disposable Supabase project.
- Add SAST/dependency scanning to CI and monthly dependency review.
- Add production dashboards for worker queue depth, failed jobs, AI usage, B2 upload errors, and Supabase DB health.
- Add rate limits to all privileged API routes, not only external discovery.
- Add immutable backup retention and periodic restore automation.
- Add CSP, security headers, and browser-side telemetry for frontend errors.
- Add per-tenant data retention controls and export/delete workflows.

## OWASP And ASVS Assessment

- Broken access control: Partial. New server routes and RLS are strong, but legacy policy audit is required.
- Cryptographic failures: Partial. TLS/B2 protection expected, but backup encryption/protection must be verified operationally.
- Injection: Pass with caveat. Supabase query builder is used. External metadata is treated as untrusted for AI; UI escaping is React-default.
- Insecure design: Partial. Approval gates exist, but legacy AI/functions and older RLS require review.
- Security misconfiguration: Partial. Coolify/Supabase/SSH firewall hardening must be completed and documented.
- Vulnerable components: Partial. `npm audit` still reports vulnerabilities; do not force-fix without regression testing.
- Identification/auth failures: Partial. Supabase Auth used; admin MFA/password policy must be operationally enforced.
- Software/data integrity: Partial. GitHub/Coolify deploy path exists; add signed release or protected branch controls later.
- Logging/monitoring: Partial. Audit tables and worker health exist; production alerting not complete.
- SSRF/external calls: Partial. Harvest adapters call external APIs with controlled endpoints; add allowlist enforcement if user-supplied URLs expand.

## NDPA 2023 Privacy Expectations

- Lawful basis: Document library service basis and consent/notice for optional communications.
- Data minimization: Keep patron PII out of AI and external discovery. Use metadata-only external lookups by default.
- Purpose limitation: Patron data should only support library account, circulation, notifications, and approved analytics.
- Security safeguards: RLS, server-side privileged actions, audit logs, SSH hardening, protected backups.
- Data subject rights: Add process for access, correction, deletion where legally permitted, and export.
- Retention: Define retention for logs, AI outputs, patron import files, rejected candidates, and backups.
- Breach response: Use `docs/incident-response-plan.md` and maintain contact/escalation details.

## Unresolved Risks

- Hosted Supabase migrations and Edge Functions are not confirmed applied in production.
- Self-hosted Supabase server is not yet provisioned or tested.
- Some older Supabase policies/functions predate the new architecture and may be too permissive.
- Backup restore has not been evidenced.
- Coolify public port exposure and Supabase Studio exposure must be verified after domain/HTTPS setup.
- Production monitoring/alerting is not fully implemented.
