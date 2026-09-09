create table if not exists public.agent_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  agent_name text not null,
  enabled boolean not null default true,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high')),
  requires_approval boolean not null default true,
  max_daily_jobs integer not null default 50,
  allowed_roles text[] not null default array['super_admin','librarian','faculty_librarian'],
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_name)
);

create table if not exists public.agent_job_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  label text not null,
  agent_name text not null,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  priority integer not null default 5,
  enabled boolean not null default true,
  requires_approval boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists agent_settings_touch_updated_at on public.agent_settings;
create trigger agent_settings_touch_updated_at before update on public.agent_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists agent_job_templates_touch_updated_at on public.agent_job_templates;
create trigger agent_job_templates_touch_updated_at before update on public.agent_job_templates
  for each row execute function public.touch_updated_at();

alter table public.agent_settings enable row level security;
alter table public.agent_job_templates enable row level security;

drop policy if exists agent_settings_admin_read on public.agent_settings;
create policy agent_settings_admin_read on public.agent_settings for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists agent_settings_global_manage on public.agent_settings;
create policy agent_settings_global_manage on public.agent_settings for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_global_admin(auth.uid()))
  with check (tenant_id = public.current_tenant_id() and public.is_global_admin(auth.uid()));

drop policy if exists agent_job_templates_admin_read on public.agent_job_templates;
create policy agent_job_templates_admin_read on public.agent_job_templates for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists agent_job_templates_global_manage on public.agent_job_templates;
create policy agent_job_templates_global_manage on public.agent_job_templates for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_global_admin(auth.uid()))
  with check (tenant_id = public.current_tenant_id() and public.is_global_admin(auth.uid()));

grant select on public.agent_settings, public.agent_job_templates to authenticated;
grant all on public.agent_settings, public.agent_job_templates to service_role;

insert into public.agent_settings (tenant_id, agent_name, enabled, risk_level, requires_approval, max_daily_jobs)
select public.default_tenant_id(), agent_name, true, risk_level, requires_approval, max_daily_jobs
from (values
  ('Cardo', 'medium', true, 50),
  ('Hari', 'high', true, 30),
  ('Thesia', 'medium', true, 40),
  ('Penna', 'high', true, 25),
  ('Norma', 'high', true, 10),
  ('Sysa', 'low', false, 100),
  ('Cizo', 'medium', true, 40)
) as seed(agent_name, risk_level, requires_approval, max_daily_jobs)
on conflict (tenant_id, agent_name) do nothing;

insert into public.agent_job_templates (tenant_id, label, agent_name, job_type, payload, priority, requires_approval)
values
  (public.default_tenant_id(), 'Worker Health Check', 'Sysa', 'system.healthCheck', '{}'::jsonb, 10, false),
  (public.default_tenant_id(), 'Weekly Tenant Report Draft', 'Sysa', 'reports.weeklyTenantReport', '{}'::jsonb, 7, true),
  (public.default_tenant_id(), 'Harvest Education Resources', 'Hari', 'resources.harvest', '{"query":"education open access Nigeria"}'::jsonb, 7, true),
  (public.default_tenant_id(), 'Overdue Circulation Summary', 'Cizo', 'circulation.overdueReminders', '{}'::jsonb, 6, true),
  (public.default_tenant_id(), 'Newsletter Draft', 'Penna', 'communications.draftNewsletter', '{"topic":"Library update","audience":"library users"}'::jsonb, 5, true)
on conflict do nothing;
