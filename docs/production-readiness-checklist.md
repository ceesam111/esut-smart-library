# Production Readiness Checklist

## Launch Status

Current status: Not ready for production launch until blockers are closed.

## Final Launch Checklist

- [ ] Hosted Supabase migrations applied in order.
- [ ] Supabase Edge Functions deployed and secrets configured.
- [ ] Self-hosted Supabase staging server provisioned and smoke-tested.
- [ ] Coolify app service deployed with HTTPS domain.
- [ ] Coolify worker service deployed with `Dockerfile.worker` and `/health` check.
- [ ] Coolify admin has strong password, HTTPS, and restricted admin access.
- [ ] Temporary Coolify setup ports closed or restricted after domain setup.
- [ ] Supabase Studio protected by strong authentication and network controls.
- [ ] Postgres port not publicly exposed, or temporarily restricted by firewall to admin IPs only.
- [ ] SSH key login verified; root password login disabled; UFW/fail2ban active.
- [ ] No service-role, B2, AI, Resend, DB, or GitHub secrets in browser bundle or Git.
- [ ] Secret scan completed and findings resolved.
- [ ] RLS audit completed for every tenant-owned table.
- [ ] Cross-tenant access tests passed.
- [ ] Role escalation tests passed.
- [ ] Patron import and approval workflow tested.
- [ ] Catalogue import, barcode scan, harvest, B2, AI, worker, and backup tests passed.
- [ ] Backup restore drill completed and signed off.
- [ ] Monitoring and alerting configured.
- [ ] Incident response contacts and escalation path confirmed.
- [ ] Privacy notice, retention schedule, and NDPA data-subject process approved.

## Environment Variables

### Browser-Safe

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Server-Only App And Worker

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_BASE_URL`
- `AI_DEFAULT_MODEL`
- `AI_FAST_MODEL`
- `AI_REASONING_MODEL`
- `B2_ENDPOINT`
- `B2_REGION`
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_LIBRARY_FILES`
- `B2_BUCKET_BACKUPS`
- `B2_BUCKET_EXPORTS`
- `B2_PUBLIC_BASE_URL`
- `RESEND_API_KEY`
- `WORKER_ID`
- `WORKER_CONCURRENCY`
- `WORKER_POLL_INTERVAL_MS`
- `WORKER_LOCK_TIMEOUT_MINUTES`
- `WORKER_HEALTH_PORT`

## Deployment Gates

### Gate 1: Code And Build

- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] Dependency audit reviewed; high/critical issues triaged.
- [ ] No unexpected generated files or secrets.

### Gate 2: Supabase

- [ ] Migrations applied to staging.
- [ ] RLS enabled on tenant-owned tables.
- [ ] Service-role grants limited to server-side use.
- [ ] Edge Functions deployed with required secrets.
- [ ] Auth settings and email templates configured.

### Gate 3: App Server

- [ ] Next.js app container healthy.
- [ ] Worker container healthy.
- [ ] Logs rotate and do not print secrets.
- [ ] Health endpoint monitored.
- [ ] Rollback image/tag identified.

### Gate 4: Data Protection

- [ ] B2 buckets use least-privilege keys.
- [ ] Backup bucket access restricted.
- [ ] Signed URLs tested.
- [ ] Restore drill completed.
- [ ] Retention schedule approved.

### Gate 5: Compliance

- [ ] NDPA privacy notice published.
- [ ] Data processing inventory completed.
- [ ] Data-subject request process documented.
- [ ] Breach reporting workflow approved.
- [ ] Staff/admin access review completed.

## Required Fixes Before Production

- Complete RLS audit for older tables and legacy policies.
- Replace or approve legacy AI Edge Functions that bypass the new Vercel AI Gateway Brain policy.
- Execute backup restore drill.
- Validate self-hosted Supabase staging deployment.
- Lock down Coolify, Supabase Studio, Postgres, and SSH.

## Recommended Fixes After Launch

- Add automated RLS tests to CI.
- Add queue dashboards for `agent_jobs`.
- Add monthly restore automation.
- Add CSP/security headers review.
- Add WAF/rate limiting at the reverse proxy.
