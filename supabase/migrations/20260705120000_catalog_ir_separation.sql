-- Separate Library Catalog and Institutional Repository without deleting data.
-- This migration is additive and safe to run before frontend rollout.

create extension if not exists pgcrypto;

create table if not exists public.ir_items (
  id uuid primary key default gen_random_uuid(),
  legacy_catalog_id uuid null,
  title text not null,
  creators jsonb not null default '[]'::jsonb,
  contributors jsonb not null default '[]'::jsonb,
  item_type text not null,
  abstract text,
  keywords text[] not null default '{}',
  department text,
  faculty text,
  date_issued text,
  publisher text,
  doi text,
  handle text unique,
  license text,
  embargo_until date,
  file_paths text[] not null default '{}',
  metadata_json jsonb not null default '{}'::jsonb,
  deposit_date timestamptz not null default now(),
  depositor_id uuid null,
  status text not null default 'draft' check (status in ('draft','published','embargoed')),
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ir_licenses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ir_embargo_logs (
  id uuid primary key default gen_random_uuid(),
  ir_item_id uuid references public.ir_items(id) on delete cascade,
  old_status text,
  new_status text,
  embargo_until date,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  notes text
);

create table if not exists public.ir_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  target_handle text,
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  catalogue_item_id uuid,
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ir_items_search on public.ir_items using gin(search_vector);
create index if not exists idx_ir_items_legacy_catalog_id on public.ir_items(legacy_catalog_id);
create index if not exists idx_ir_items_handle on public.ir_items(handle);
create index if not exists idx_ir_items_department_status on public.ir_items(department, status);

insert into public.ir_licenses(code, name, url, description) values
  ('CC-BY-4.0', 'Creative Commons Attribution 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'Open reuse with attribution'),
  ('CC-BY-NC-4.0', 'Creative Commons Attribution NonCommercial 4.0', 'https://creativecommons.org/licenses/by-nc/4.0/', 'Non-commercial reuse with attribution'),
  ('INSTITUTIONAL', 'Institutional Use Only', null, 'Accessible according to institutional policy')
on conflict (code) do nothing;

create or replace function public.ir_items_search_vector_refresh()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.abstract,'')), 'B') ||
    setweight(to_tsvector('english', array_to_string(new.keywords, ' ')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.department,'')), 'D');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ir_items_search_vector on public.ir_items;
create trigger trg_ir_items_search_vector
before insert or update on public.ir_items
for each row execute function public.ir_items_search_vector_refresh();

-- Data copy is intentionally handled by scripts/migrate-catalog-ir.ts so teams can
-- dry-run and verify counts before copying legacy catalogue records. catalogue_items
-- remains untouched for the 30-day rollback window.
