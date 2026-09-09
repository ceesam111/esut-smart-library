# Smart Library Worker On Coolify

The worker is a separate Node runtime for controlled background agents. It runs beside the Next.js app on the App Server managed by Coolify and uses Supabase as the job queue.

## Database

Apply migration:

`supabase/migrations/20260626143000_agent_jobs_worker_runtime.sql`

It creates `agent_jobs` and `claim_agent_jobs(worker_id, limit, lock_timeout_minutes)`. The claim function uses `FOR UPDATE SKIP LOCKED`, so multiple worker containers can run without duplicate execution.

## Agents And Handlers

- Cardo: `catalogue.enrich`
- Hari: `resources.harvest`, `resources.downloadToB2`
- Thesia: `repository.extractMetadata`
- Penna: `communications.draftNewsletter`
- Norma: reserved for accreditation jobs through approval queues
- Sysa: `reports.weeklyTenantReport`, `system.healthCheck`
- Cizo: `circulation.overdueReminders`

All handlers require `tenant_id`. Approval-sensitive work is staged in `approval_queue` or candidate tables and does not auto-publish.

## Required Environment Variables

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_ID`
- `WORKER_CONCURRENCY`
- `WORKER_POLL_INTERVAL_MS`
- `WORKER_LOCK_TIMEOUT_MINUTES`
- `WORKER_HEALTH_PORT`
- `WORKER_SCHEDULER_ENABLED`
- `WORKER_SCHEDULER_INTERVAL_MS`
- `WORKER_HEALTH_URL` on the Next.js app service, pointing to the worker health endpoint when using the `/admin/agents` health panel.

Optional, depending on jobs:

- `AI_GATEWAY_API_KEY`
- `B2_ENDPOINT`
- `B2_REGION`
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_LIBRARY_FILES`
- `RESEND_API_KEY`

## Local Run

From `esut-smart-library`:

```bash
npm install
npm run worker
```

Health endpoint:

```bash
curl http://localhost:8787/health
```

## Coolify Deployment

Create a second application/service from the same Git repository.

- Dockerfile: `Dockerfile.worker`
- Build context: repository root or nested app folder depending on Coolify setup
- Port: `8787`
- Health path: `/health`
- Restart policy: always/on-failure

Use the same Supabase environment variables as the app, but keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

Recommended production worker settings:

```env
WORKER_ID=esut-worker-1
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=5000
WORKER_LOCK_TIMEOUT_MINUTES=15
WORKER_HEALTH_PORT=8787
WORKER_SCHEDULER_ENABLED=true
WORKER_SCHEDULER_INTERVAL_MS=60000
```

Set this on the Next.js app service so `/admin/agents` can show worker health:

```env
WORKER_HEALTH_URL=http://<coolify-worker-service-name>:8787/health
```

If Coolify does not provide internal DNS between services, keep the worker health panel disabled/unreachable or expose the worker only on a private network. Do not publish the service-role key or worker internals to browser-accessible env variables.

## Enqueue A Job

Example SQL:

```sql
insert into public.agent_jobs (tenant_id, job_type, agent_name, payload, priority)
values (
  '00000000-0000-0000-0000-000000000001',
  'system.healthCheck',
  'Sysa',
  '{}',
  10
);
```

## Safety

- Database-backed locking prevents duplicate execution.
- Failed jobs retry with exponential backoff until `max_attempts`.
- Recurring schedules in `agent_schedules` are converted into `agent_jobs` by the worker scheduler loop.
- Every job writes to `agent_runs` and `audit_logs`.
- Repository publication, newsletters, accreditation reports, and other sensitive outputs are staged for human approval.
- Patron bulk enrolment is not implemented as an AI job.
- Large legal resource downloads go directly to B2 and only after rights are clear.

## Switching To Self-Hosted Supabase Later

Change only:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The worker uses Supabase APIs/RPC and remains compatible with hosted or self-hosted Supabase.
