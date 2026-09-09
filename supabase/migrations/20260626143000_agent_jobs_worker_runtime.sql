-- Database-backed worker queue for Smart Library agents.

create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  job_type text not null,
  agent_name text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  priority integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz null,
  locked_by text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists agent_jobs_touch_updated_at on public.agent_jobs;
create trigger agent_jobs_touch_updated_at before update on public.agent_jobs
  for each row execute function public.touch_updated_at();

create index if not exists idx_agent_jobs_status_run_after_priority on public.agent_jobs(status, run_after, priority desc, created_at);
create index if not exists idx_agent_jobs_tenant_job_type on public.agent_jobs(tenant_id, job_type);
create index if not exists idx_agent_jobs_locked_at on public.agent_jobs(locked_at);
create index if not exists idx_agent_jobs_created_at on public.agent_jobs(created_at desc);

alter table public.agent_jobs enable row level security;

drop policy if exists agent_jobs_admin_read on public.agent_jobs;
create policy agent_jobs_admin_read on public.agent_jobs for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists agent_jobs_admin_insert on public.agent_jobs;
create policy agent_jobs_admin_insert on public.agent_jobs for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

grant select, insert on public.agent_jobs to authenticated;
grant all on public.agent_jobs to service_role;

create or replace function public.claim_agent_jobs(_worker_id text, _limit integer default 1, _lock_timeout_minutes integer default 15)
returns setof public.agent_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimable as (
    select id
    from public.agent_jobs
    where (
      status = 'pending'
      or (status = 'running' and locked_at < now() - make_interval(mins => _lock_timeout_minutes))
    )
      and run_after <= now()
      and attempts < max_attempts
    order by priority desc, run_after asc, created_at asc
    limit greatest(_limit, 1)
    for update skip locked
  )
  update public.agent_jobs j
  set status = 'running',
      locked_at = now(),
      locked_by = _worker_id,
      started_at = coalesce(j.started_at, now()),
      attempts = j.attempts + 1,
      error = null,
      updated_at = now()
  from claimable
  where j.id = claimable.id
  returning j.*;
end;
$$;

grant execute on function public.claim_agent_jobs(text, integer, integer) to service_role;
