create table if not exists public.agent_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  label text not null,
  agent_name text not null,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  priority integer not null default 5,
  enabled boolean not null default true,
  interval_minutes integer not null default 1440,
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists agent_schedules_touch_updated_at on public.agent_schedules;
create trigger agent_schedules_touch_updated_at before update on public.agent_schedules
  for each row execute function public.touch_updated_at();

create index if not exists idx_agent_schedules_due on public.agent_schedules(enabled, next_run_at);
create index if not exists idx_agent_schedules_tenant on public.agent_schedules(tenant_id, agent_name);

alter table public.agent_schedules enable row level security;

drop policy if exists agent_schedules_admin_read on public.agent_schedules;
create policy agent_schedules_admin_read on public.agent_schedules for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists agent_schedules_global_manage on public.agent_schedules;
create policy agent_schedules_global_manage on public.agent_schedules for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_global_admin(auth.uid()))
  with check (tenant_id = public.current_tenant_id() and public.is_global_admin(auth.uid()));

grant select on public.agent_schedules to authenticated;
grant all on public.agent_schedules to service_role;

insert into public.agent_schedules (tenant_id, label, agent_name, job_type, payload, priority, interval_minutes, next_run_at)
values
  (public.default_tenant_id(), 'Daily worker health check', 'Sysa', 'system.healthCheck', '{}'::jsonb, 10, 1440, now() + interval '1 hour'),
  (public.default_tenant_id(), 'Weekly tenant report', 'Sysa', 'reports.weeklyTenantReport', '{}'::jsonb, 7, 10080, now() + interval '1 day'),
  (public.default_tenant_id(), 'Daily overdue circulation summary', 'Cizo', 'circulation.overdueReminders', '{}'::jsonb, 6, 1440, now() + interval '2 hours')
on conflict do nothing;
