# Incident Response Plan

Purpose: respond to security, privacy, availability, data integrity, and operational incidents for Smart Library.

## Severity Levels

| Severity | Description | Examples | Initial Response Target |
| --- | --- | --- | --- |
| Sev 1 | Critical breach or outage | Service-role key exposed, cross-tenant data leak, DB unavailable, ransomware | 15 minutes |
| Sev 2 | Major degraded security/availability | Worker runaway jobs, B2 private object exposure, admin account compromise | 1 hour |
| Sev 3 | Limited impact | Single failed backup, non-sensitive UI bug, one adapter outage | 1 business day |
| Sev 4 | Low-risk issue | Documentation gap, minor alert noise | Next planning cycle |

## Incident Types

- Secret exposure.
- Unauthorized access or role escalation.
- Cross-tenant data exposure.
- Patron PII exposure.
- AI policy violation or PII sent to AI.
- B2 private object exposure.
- Backup failure or restore failure.
- Worker duplicate execution or runaway retries.
- Supabase/Postgres outage.
- Coolify/App Server compromise.

## Response Workflow

1. Detect and classify severity.
2. Assign incident commander.
3. Preserve evidence:
   - Coolify logs.
   - App/worker logs.
   - Supabase logs.
   - `audit_logs`.
   - `agent_runs` and `agent_jobs`.
   - B2 access logs/inventory if available.
4. Contain:
   - Rotate exposed keys.
   - Disable compromised accounts.
   - Stop worker if jobs are unsafe.
   - Restrict firewall ports.
   - Disable affected routes/functions if needed.
5. Eradicate root cause.
6. Recover service from clean state or backup.
7. Validate RLS/security tests.
8. Communicate to stakeholders.
9. Complete post-incident review.

## Secret Exposure Playbook

1. Identify exposed secret and scope.
2. Revoke/rotate immediately:
   - Supabase service role key.
   - Supabase anon key if abused.
   - B2 application key.
   - AI Gateway key.
   - Resend key.
   - GitHub/Coolify deploy tokens.
3. Remove secret from logs/Git where possible.
4. Review access logs for misuse.
5. Redeploy app and worker with new secrets.
6. Add regression guard or secret scan rule.

## Cross-Tenant Exposure Playbook

1. Disable affected route or table access if needed.
2. Capture offending request/user/tenant IDs.
3. Review RLS policies and server query filters.
4. Patch policy/query and deploy migration.
5. Run cross-tenant test suite.
6. Determine affected records and notification duties.

## AI Privacy Incident Playbook

1. Stop affected AI job/function.
2. Identify prompt, payload, model, and `agent_runs` entry.
3. Confirm whether patron PII was sent.
4. Rotate AI key if logs or third-party exposure require it.
5. Update redaction/policy tests.
6. Review NDPA notification obligations.

## Backup Failure Playbook

1. Check latest successful backup timestamp.
2. Fix backup job, credentials, or storage quota.
3. Run immediate backup.
4. Execute partial restore verification if failure lasted beyond RPO.
5. Record missed RPO and remediation.

## Communication

- Internal technical channel: define before launch.
- Library administration contact: define before launch.
- Data protection/privacy contact: define before launch.
- Public status page or notice channel: define before launch.

## Post-Incident Review Template

- Incident ID:
- Severity:
- Start/end time:
- Detection source:
- Affected tenants/users/data:
- Root cause:
- What worked:
- What failed:
- Corrective actions:
- Owner and due dates:
- NDPA notification required:
- Final sign-off:
