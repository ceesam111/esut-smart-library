-- SLAAS: Smart Library Access & Analytics System
-- Core domain model. Reuses patrons, user_roles, audit_logs, analytics_events,
-- academic_calendar. Adds only the access-attendance concepts that do not exist yet.

-- ---------------------------------------------------------------------------
-- 1. LibraryBranch
-- ---------------------------------------------------------------------------
create table if not exists public.library_branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  code text not null,
  name text not null,
  location text,
  timezone text not null default 'Africa/Lagos',
  operating_hours jsonb not null default '{}'::jsonb,
  capacity int not null default 0 check (capacity >= 0),
  capacity_mode text not null default 'informational'
    check (capacity_mode in ('informational', 'warning', 'enforced')),
  warn_threshold_pct int not null default 80 check (warn_threshold_pct between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
alter table public.library_branches enable row level security;

-- ---------------------------------------------------------------------------
-- 2. LibraryAccessIdentity
-- ---------------------------------------------------------------------------
create table if not exists public.library_access_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  patron_id uuid not null references public.patrons(id) on delete cascade,
  secure_token_hash text not null unique,
  qr_version int not null default 1,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),
  barcode text,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.library_access_identities enable row level security;

create unique index if not exists uq_library_access_patron_active
  on public.library_access_identities (patron_id)
  where status = 'active';

create index if not exists idx_library_access_patron on public.library_access_identities (patron_id);
create index if not exists idx_library_access_status on public.library_access_identities (status);

-- ---------------------------------------------------------------------------
-- 3. AccessVisit
-- ---------------------------------------------------------------------------
create table if not exists public.access_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  access_identity_id uuid not null references public.library_access_identities(id) on delete cascade,
  branch_id uuid not null references public.library_branches(id) on delete restrict,
  patron_id uuid not null references public.patrons(id) on delete cascade,
  visitor_id uuid,
  status text not null default 'checked_in'
    check (status in ('checked_in', 'checked_out', 'auto_closed')),
  entry_method text not null default 'qr'
    check (entry_method in ('qr', 'manual', 'visitor_pass', 'import', 'correction', 'auto_close')),
  exit_method text check (exit_method in ('qr', 'manual', 'visitor_pass', 'import', 'correction', 'auto_close')),
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  duration_minutes int check (duration_minutes is null or duration_minutes >= 0),
  academic_session text,
  semester text,
  is_observed boolean not null default true,
  correction_reason text,
  corrected_by uuid references auth.users(id) on delete set null,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint c_visit_checkout_after_entry check (checked_out_at is null or checked_out_at >= checked_in_at)
);
alter table public.access_visits enable row level security;

-- Invariant: at most one open visit per access identity (per tenant).
create unique index if not exists uq_access_visit_open_identity
  on public.access_visits (access_identity_id)
  where status = 'checked_in';

create index if not exists idx_access_visits_branch_status
  on public.access_visits (branch_id, status);
create index if not exists idx_access_visits_checked_in_at
  on public.access_visits (checked_in_at);
create index if not exists idx_access_visits_patron
  on public.access_visits (patron_id, checked_in_at);
create index if not exists idx_access_visits_tenant_branch_time
  on public.access_visits (tenant_id, branch_id, checked_in_at);
create index if not exists idx_access_visits_session_semester
  on public.access_visits (academic_session, semester);

-- ---------------------------------------------------------------------------
-- 4. AccessEvent
-- ---------------------------------------------------------------------------
create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  access_identity_id uuid references public.library_access_identities(id) on delete set null,
  visit_id uuid references public.access_visits(id) on delete set null,
  patron_id uuid references public.patrons(id) on delete set null,
  visitor_id uuid,
  branch_id uuid references public.library_branches(id) on delete set null,
  event_type text not null check (event_type in (
    'CHECK_IN', 'CHECK_OUT', 'DENIED', 'DUPLICATE_SCAN', 'MANUAL_CHECK_IN', 'MANUAL_CHECK_OUT',
    'CORRECTION', 'AUTO_CLOSE', 'VISITOR_ENTRY', 'VISITOR_EXIT', 'VISITOR_PASS_ISSUED', 'VISITOR_PASS_REVOKED'
  )),
  event_source text not null default 'qr'
    check (event_source in ('qr', 'manual', 'visitor_pass', 'system', 'correction', 'auto_close')),
  workstation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.access_events enable row level security;

create index if not exists idx_access_events_type_time
  on public.access_events (event_type, created_at);
create index if not exists idx_access_events_branch_time
  on public.access_events (branch_id, created_at);
create index if not exists idx_access_events_visit
  on public.access_events (visit_id);

-- ---------------------------------------------------------------------------
-- 5. Visitor
-- ---------------------------------------------------------------------------
create table if not exists public.access_visitors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  full_name text not null,
  organization text,
  purpose text,
  host_department text,
  contact_email text,
  contact_phone text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.access_visitors enable row level security;

-- ---------------------------------------------------------------------------
-- 6. VisitorPass
-- ---------------------------------------------------------------------------
create table if not exists public.access_visitor_passes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  visitor_id uuid not null references public.access_visitors(id) on delete cascade,
  branch_id uuid not null references public.library_branches(id) on delete restrict,
  secure_token_hash text not null unique,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'used', 'revoked', 'expired')),
  issued_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint c_pass_valid_window check (valid_until > valid_from)
);
alter table public.access_visitor_passes enable row level security;

create index if not exists idx_visitor_passes_status on public.access_visitor_passes (status);
create index if not exists idx_visitor_passes_visitor on public.access_visitor_passes (visitor_id);
create index if not exists idx_visitor_passes_valid_until on public.access_visitor_passes (valid_until);

-- Back-reference from visit to visitor + pass.
alter table public.access_visits
  add column if not exists visitor_pass_id uuid references public.access_visitor_passes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 7. CapacityHistory (effective-dated capacity, for consistent historical reports)
-- ---------------------------------------------------------------------------
create table if not exists public.library_branch_capacity_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  branch_id uuid not null references public.library_branches(id) on delete cascade,
  capacity int not null check (capacity >= 0),
  capacity_mode text not null default 'informational'
    check (capacity_mode in ('informational', 'warning', 'enforced')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.library_branch_capacity_history enable row level security;

create index if not exists idx_capacity_history_branch
  on public.library_branch_capacity_history (branch_id, effective_from);

-- ---------------------------------------------------------------------------
-- 8. ScanWorkstation
-- ---------------------------------------------------------------------------
create table if not exists public.library_scan_workstations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  branch_id uuid not null references public.library_branches(id) on delete restrict,
  name text not null,
  mode text not null default 'AUTO' check (mode in ('AUTO', 'CHECK_IN_ONLY', 'CHECK_OUT_ONLY')),
  enabled boolean not null default true,
  trusted_scanner_id text,
  last_seen_at timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.library_scan_workstations enable row level security;

-- ---------------------------------------------------------------------------
-- 9. SLAAS configuration (privacy notice, retention, scanner defaults)
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, description)
values (
  'slaas_config',
  '{
    "scannerDebounceMs": 5000,
    "autoCloseAfterHours": null,
    "privacyNotice": null,
    "retentionMonths": 60,
    "dynamicQrEnabled": false,
    "dynamicQrTtlSeconds": 120
  }'::jsonb,
  'SLAAS access-analytics configuration (debounce, retention, privacy, dynamic QR).'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- RLS policies (service-role full access; authenticated read/write per role)
-- ---------------------------------------------------------------------------
-- All SLAAS tables: service role full. Authenticated handled at API layer via
-- requireRole + writeAuditLog; RLS here is the hard backstop that blocks anon.
do $$
declare
  t text;
begin
  foreach t in array array[
    'library_branches',
    'library_access_identities',
    'access_visits',
    'access_events',
    'access_visitors',
    'access_visitor_passes',
    'library_branch_capacity_history',
    'library_scan_workstations'
  ] loop
    execute format(
      'drop policy if exists slaas_service_all on public.%I;
       create policy slaas_service_all on public.%I for all to service_role using (true) with check (true);',
      t, t
    );
    execute format(
      'drop policy if exists slaas_auth_read on public.%I;
       create policy slaas_auth_read on public.%I for select to authenticated using (true);',
      t, t
    );
  end loop;
end $$;
