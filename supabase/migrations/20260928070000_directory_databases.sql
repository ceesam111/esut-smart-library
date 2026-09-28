-- Wave: library directory management (Open Access + Subscribed Databases)
-- Adds an admin-managed overlay table for the two public database directories.
-- Public reads are open (anon SELECT); all writes go through the authenticated
-- admin API routes which use the service-role client, so no write policies.
-- Rollback: drop table public.directory_databases;

create table if not exists public.directory_databases (
  id text not null,
  directory text not null check (directory in ('open_access', 'subscribed')),
  name text not null,
  is_active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, directory)
);

alter table public.directory_databases enable row level security;

drop policy if exists "directory public read" on public.directory_databases;
create policy "directory public read"
  on public.directory_databases
  for select
  to anon, authenticated
  using (true);

create index if not exists directory_databases_directory_idx
  on public.directory_databases (directory);
