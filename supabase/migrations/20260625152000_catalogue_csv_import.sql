-- CSV catalogue import staging. Imports never write directly to live catalogue.

alter table if exists public.catalogue_items
  add column if not exists tenant_id uuid not null default public.default_tenant_id();

alter table if exists public.catalogue_copies
  add column if not exists tenant_id uuid not null default public.default_tenant_id();

create index if not exists idx_catalogue_items_tenant_id on public.catalogue_items(tenant_id);
create index if not exists idx_catalogue_items_tenant_isbn on public.catalogue_items(tenant_id, isbn);
create index if not exists idx_catalogue_copies_tenant_id on public.catalogue_copies(tenant_id);

create table if not exists public.catalogue_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  filename text,
  source text not null default 'csv_bulk',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  warning_rows integer not null default 0,
  error_rows integer not null default 0,
  clean_matches integer not null default 0,
  needs_review integer not null default 0,
  status text not null default 'staged',
  created_at timestamptz not null default now()
);

create table if not exists public.catalogue_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.default_tenant_id(),
  batch_id uuid not null references public.catalogue_import_batches(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  source text not null default 'csv_bulk',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_changes')),
  confidence text not null default 'needs_review' check (confidence in ('clean_match', 'needs_review', 'no_match', 'conflict')),
  isbn text null,
  title text null,
  authors text[] not null default '{}',
  publisher text null,
  year integer null,
  edition text null,
  language text null,
  category text null,
  subjects text[] not null default '{}',
  copies integer not null default 1,
  shelf_location text null,
  item_type text not null default 'book' check (item_type in ('book', 'journal', 'ebook', 'database')),
  source_url text null,
  cover_url text null,
  notes text null,
  raw_row jsonb not null default '{}'::jsonb,
  enriched_data jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  validation_warnings jsonb not null default '[]'::jsonb,
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  rejected_by uuid null references auth.users(id) on delete set null,
  rejected_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists catalogue_staging_touch_updated_at on public.catalogue_staging;
create trigger catalogue_staging_touch_updated_at
  before update on public.catalogue_staging
  for each row execute function public.touch_updated_at();

create index if not exists idx_catalogue_import_batches_tenant_id on public.catalogue_import_batches(tenant_id);
create index if not exists idx_catalogue_import_batches_created_at on public.catalogue_import_batches(created_at desc);
create index if not exists idx_catalogue_import_batches_status on public.catalogue_import_batches(status);

create index if not exists idx_catalogue_staging_tenant_id on public.catalogue_staging(tenant_id);
create index if not exists idx_catalogue_staging_batch_id on public.catalogue_staging(batch_id);
create index if not exists idx_catalogue_staging_status on public.catalogue_staging(status);
create index if not exists idx_catalogue_staging_confidence on public.catalogue_staging(confidence);
create index if not exists idx_catalogue_staging_isbn on public.catalogue_staging(isbn);
create index if not exists idx_catalogue_staging_created_at on public.catalogue_staging(created_at desc);
create index if not exists idx_catalogue_staging_tenant_status_confidence on public.catalogue_staging(tenant_id, status, confidence);

alter table public.catalogue_import_batches enable row level security;
alter table public.catalogue_staging enable row level security;

drop policy if exists catalogue_import_batches_admin_read on public.catalogue_import_batches;
create policy catalogue_import_batches_admin_read
  on public.catalogue_import_batches for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists catalogue_staging_admin_read on public.catalogue_staging;
create policy catalogue_staging_admin_read
  on public.catalogue_staging for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

drop policy if exists catalogue_staging_admin_update on public.catalogue_staging;
create policy catalogue_staging_admin_update
  on public.catalogue_staging for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()))
  with check (tenant_id = public.current_tenant_id() and public.is_library_admin(auth.uid()));

grant select on public.catalogue_import_batches to authenticated;
grant select, update on public.catalogue_staging to authenticated;

grant all on public.catalogue_import_batches to service_role;
grant all on public.catalogue_staging to service_role;
