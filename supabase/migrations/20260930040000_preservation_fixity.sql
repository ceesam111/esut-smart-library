-- BATCH 7: Preservation, fixity, and real AIP
alter table public.repository_files
  add column if not exists last_verified_at timestamptz,
  add column if not exists next_verification_at timestamptz,
  add column if not exists last_verification_result text,
  add column if not exists observed_checksum text;

create table if not exists public.preservation_events (
  id uuid primary key default gen_random_uuid(),
  repository_file_id uuid not null references public.repository_files(id) on delete cascade,
  event_type text not null check (event_type in ('INGESTED', 'CHECKSUM_CALCULATED', 'FIXITY_VERIFIED', 'FIXITY_FAILED', 'AIP_EXPORTED', 'RESTORED', 'FILE_REPLACED')),
  details jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.preservation_incidents (
  id uuid primary key default gen_random_uuid(),
  repository_file_id uuid not null references public.repository_files(id) on delete cascade,
  incident_type text not null check (incident_type in ('MISMATCH', 'MISSING', 'ERROR')),
  expected_checksum text,
  observed_checksum text,
  details jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_preservation_events_file on public.preservation_events(repository_file_id);
create index if not exists idx_preservation_incidents_file on public.preservation_incidents(repository_file_id);

alter table public.preservation_events enable row level security;
alter table public.preservation_incidents enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='preservation_events' and policyname='preservation_service_all') then
    create policy "preservation_service_all" on public.preservation_events for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='preservation_incidents' and policyname='preservation_incidents_service_all') then
    create policy "preservation_incidents_service_all" on public.preservation_incidents for all to service_role using (true) with check (true);
  end if;
end $$;
