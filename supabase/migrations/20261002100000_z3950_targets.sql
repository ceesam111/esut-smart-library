create table if not exists z3950_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  host text not null,
  port integer not null default 210,
  database text not null,
  description text,
  enabled boolean not null default true,
  trusted boolean not null default false,
  default_index text not null default 'keyword',
  use_attribute_overrides jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_status text,
  last_error text
);

create table if not exists z3950_search_audit (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references z3950_targets(id) on delete set null,
  target_name text,
  query text not null,
  index_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  hit_count integer,
  records_returned integer,
  outcome text not null,
  error_detail text,
  requested_by uuid references auth.users(id) on delete set null
);

alter table z3950_targets enable row level security;
alter table z3950_search_audit enable row level security;

create policy "z3950_targets_read" on z3950_targets for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "z3950_targets_write" on z3950_targets for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "z3950_audit_read" on z3950_search_audit for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "z3950_audit_write" on z3950_search_audit for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

insert into z3950_targets (name, host, port, database, description, trusted) values
  ('Library of Congress', 'lx2.loc.gov', 210, 'LCDB', 'US Library of Congress Z39.50 catalog', true),
  ('British Library', 'z3950.bl.uk', 9909, 'BLAC', 'British Library catalog', true)
on conflict do nothing;
