-- Shared backend foundation for approvals, audit, AI/job logs, and worker runs.
-- This keeps Supabase compatibility while preparing for a future standalone Postgres migration.

create extension if not exists "pgcrypto";

create or replace function public.default_tenant_id()
returns uuid
language sql
stable
as $$
  select '00000000-0000-0000-0000-000000000001'::uuid;
$$;

alter table if exists public.patrons
  add column if not exists tenant_id uuid not null default public.default_tenant_id();

alter table if exists public.user_roles
  add column if not exists tenant_id uuid not null default public.default_tenant_id();

create index if not exists idx_patrons_tenant_id on public.patrons(tenant_id);
create index if not exists idx_user_roles_tenant_id on public.user_roles(tenant_id);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.tenant_id from public.patrons p where p.user_id = auth.uid() limit 1),
    (select ur.tenant_id from public.user_roles ur where ur.user_id = auth.uid() limit 1),
    public.default_tenant_id()
  );
$$;

create or replace function public.has_any_role(_user_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role::text = any(_roles)
  )
  or exists (
    select 1
    from public.patrons p
    where p.user_id = _user_id
      and p.account_role = any(_roles)
  );
$$;

create or replace function public.is_library_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(_user_id, array['super_admin','librarian','faculty_librarian','admin','admin_staff']);
$$;

create or replace function public.is_global_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(_user_id, array['super_admin','librarian','admin']);
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.approval_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  source_table text,
  source_id uuid,
  content_type text not null,
  action_type text not null,
  risk_tier text not null check (risk_tier in ('auto', 'human', 'blocked')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_changes', 'auto_published', 'cancelled')),
  title text,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  assigned_to uuid null references auth.users(id) on delete set null,
  submitted_by uuid null references auth.users(id) on delete set null,
  approved_by uuid null references auth.users(id) on delete set null,
  rejected_by uuid null references auth.users(id) on delete set null,
  decision_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz null
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  before_data jsonb null,
  after_data jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists tenant_id uuid null;
alter table public.audit_logs add column if not exists actor_user_id uuid null references auth.users(id) on delete set null;
alter table public.audit_logs add column if not exists actor_role text null;
alter table public.audit_logs add column if not exists entity_type text null;
alter table public.audit_logs add column if not exists entity_id uuid null;
alter table public.audit_logs add column if not exists before_data jsonb null;
alter table public.audit_logs add column if not exists after_data jsonb null;
alter table public.audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  agent_name text not null,
  job_type text not null,
  status text not null default 'pending',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text null,
  model text null,
  ai_provider text null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric not null default 0,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_ai_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  agent_run_id uuid null references public.agent_runs(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric not null default 0,
  purpose text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_job_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null,
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  error text null,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists approval_queue_touch_updated_at on public.approval_queue;
create trigger approval_queue_touch_updated_at
  before update on public.approval_queue
  for each row execute function public.touch_updated_at();

create index if not exists idx_approval_queue_tenant_id on public.approval_queue(tenant_id);
create index if not exists idx_approval_queue_status on public.approval_queue(status);
create index if not exists idx_approval_queue_created_at on public.approval_queue(created_at desc);
create index if not exists idx_approval_queue_tenant_status_content on public.approval_queue(tenant_id, status, content_type);
create index if not exists idx_approval_queue_assigned_to on public.approval_queue(assigned_to);

create index if not exists idx_audit_logs_tenant_id on public.audit_logs(tenant_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(tenant_id, entity_type, entity_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id);

create index if not exists idx_agent_runs_tenant_id on public.agent_runs(tenant_id);
create index if not exists idx_agent_runs_status on public.agent_runs(status);
create index if not exists idx_agent_runs_created_at on public.agent_runs(created_at desc);
create index if not exists idx_agent_runs_tenant_agent_status on public.agent_runs(tenant_id, agent_name, status);

create index if not exists idx_tenant_ai_usage_tenant_id on public.tenant_ai_usage(tenant_id);
create index if not exists idx_tenant_ai_usage_created_at on public.tenant_ai_usage(created_at desc);
create index if not exists idx_tenant_ai_usage_agent_run on public.tenant_ai_usage(agent_run_id);

create index if not exists idx_scheduled_job_runs_tenant_id on public.scheduled_job_runs(tenant_id);
create index if not exists idx_scheduled_job_runs_status on public.scheduled_job_runs(status);
create index if not exists idx_scheduled_job_runs_created_at on public.scheduled_job_runs(started_at desc);

alter table public.approval_queue enable row level security;
alter table public.audit_logs enable row level security;
alter table public.agent_runs enable row level security;
alter table public.tenant_ai_usage enable row level security;
alter table public.scheduled_job_runs enable row level security;

drop policy if exists approval_queue_admin_read on public.approval_queue;
create policy approval_queue_admin_read
  on public.approval_queue for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_library_admin(auth.uid())
    and (
      content_type not in ('patron', 'patron_import', 'patron_enrolment')
      or public.is_global_admin(auth.uid())
    )
  );

drop policy if exists approval_queue_admin_update on public.approval_queue;
create policy approval_queue_admin_update
  on public.approval_queue for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_library_admin(auth.uid())
    and (
      content_type not in ('patron', 'patron_import', 'patron_enrolment')
      or public.is_global_admin(auth.uid())
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_library_admin(auth.uid())
  );

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read
  on public.audit_logs for select to authenticated
  using (
    (tenant_id is null or tenant_id = public.current_tenant_id())
    and public.is_global_admin(auth.uid())
  );

drop policy if exists agent_runs_admin_read on public.agent_runs;
create policy agent_runs_admin_read
  on public.agent_runs for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists tenant_ai_usage_admin_read on public.tenant_ai_usage;
create policy tenant_ai_usage_admin_read
  on public.tenant_ai_usage for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_global_admin(auth.uid()));

drop policy if exists scheduled_job_runs_admin_read on public.scheduled_job_runs;
create policy scheduled_job_runs_admin_read
  on public.scheduled_job_runs for select to authenticated
  using ((tenant_id is null or tenant_id = public.current_tenant_id()) and public.is_library_admin(auth.uid()));

grant select, update on public.approval_queue to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.agent_runs to authenticated;
grant select on public.tenant_ai_usage to authenticated;
grant select on public.scheduled_job_runs to authenticated;

grant all on public.approval_queue to service_role;
grant all on public.audit_logs to service_role;
grant all on public.agent_runs to service_role;
grant all on public.tenant_ai_usage to service_role;
grant all on public.scheduled_job_runs to service_role;
