-- BATCH 14: Offline circulation completion.
-- Durable idempotent sync ledger + workstation registry.
-- Statuses: PENDING (claim), APPLIED, ALREADY_APPLIED, CONFLICT, REJECTED, RETRYABLE_ERROR.

create table if not exists public.offline_workstations (
  device_id text primary key,
  label text not null default '',
  branch text not null default '',
  registered_by uuid references auth.users(id) on delete set null,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  last_seq bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.offline_transactions (
  id uuid primary key default gen_random_uuid(),
  client_txn_id uuid not null unique,
  device_id text not null,
  operator_id uuid not null,
  queued_by uuid,
  branch text not null default '',
  operation text not null check (operation in ('checkout', 'checkin', 'renew')),
  local_seq bigint not null,
  payload jsonb not null default '{}'::jsonb,
  client_timestamp timestamptz,
  cache_fetched_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPLIED', 'ALREADY_APPLIED', 'CONFLICT', 'REJECTED', 'RETRYABLE_ERROR')),
  conflict_code text,
  message text not null default '',
  server_entity_id uuid,
  attempts int not null default 1,
  last_error text,
  resolution text check (resolution in ('retry', 'accept_server', 'cancel', 'override')),
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ordering guard: one ledger row per device sequence number.
create unique index if not exists uq_offline_transactions_device_seq
  on public.offline_transactions (device_id, local_seq);

create index if not exists idx_offline_transactions_status
  on public.offline_transactions (status, updated_at desc);

create index if not exists idx_offline_transactions_device
  on public.offline_transactions (device_id, created_at desc);

create index if not exists idx_offline_transactions_operator
  on public.offline_transactions (operator_id, created_at desc);

alter table public.offline_workstations enable row level security;
alter table public.offline_transactions enable row level security;
-- Service-role only: all access flows through role-gated API routes.
grant all on public.offline_workstations to service_role;
grant all on public.offline_transactions to service_role;
