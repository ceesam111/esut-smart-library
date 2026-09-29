-- SIP2 terminal credentials and audit log
create table if not exists public.sip2_terminals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution_id text not null,
  login_username text not null,
  password_hash text not null,
  is_active boolean not null default true,
  allowed_operations text[] not null default '{}',
  permitted_ip_cidr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_successful_auth timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  unique(institution_id, login_username)
);

create index if not exists idx_sip2_terminals_institution on public.sip2_terminals(institution_id);

create table if not exists public.sip2_audit_log (
  id uuid primary key default gen_random_uuid(),
  terminal_id uuid references public.sip2_terminals(id) on delete set null,
  event text not null,
  success boolean not null,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sip2_audit_terminal on public.sip2_audit_log(terminal_id);
create index if not exists idx_sip2_audit_created on public.sip2_audit_log(created_at desc);

alter table public.sip2_terminals enable row level security;
alter table public.sip2_audit_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='sip2_terminals' and policyname='sip2_terminals_service_read') then
    create policy "sip2_terminals_service_read" on public.sip2_terminals for select to service_role using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='sip2_audit_log' and policyname='sip2_audit_service_insert') then
    create policy "sip2_audit_service_insert" on public.sip2_audit_log for insert to service_role with check (true);
  end if;
end $$;
