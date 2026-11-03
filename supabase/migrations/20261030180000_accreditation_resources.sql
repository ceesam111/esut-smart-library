-- NUC 2026 accreditation resource expansion.
-- Adds a normalised store for harvested external scholarly records
-- (scholarly_resources) plus resumable sync checkpoints
-- (resource_sync_state). Existing tables are untouched; all writes go
-- through the service role from the accreditation sync engine.
--
-- REVERSAL (run manually if this migration must be undone):
--   drop table if exists public.resource_sync_state;
--   drop table if exists public.scholarly_resources;

create table if not exists public.scholarly_resources (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null,
  external_id text not null,
  resource_type text not null check (
    resource_type in ('ebook','ejournal','research_article','report','dataset','thesis','standard','course_material')
  ),
  title text not null,
  creators text[] not null default '{}',
  publisher text,
  publication_date text,
  publication_year int check (publication_year between 1400 and 2100),
  doi text,
  isbn text,
  issn text,
  language text,
  subject_headings text[] not null default '{}',
  abstract_text text,
  landing_page_url text not null,
  full_text_url text,
  access_state text not null default 'metadata_only' check (
    access_state in ('full_text','abstract_only','metadata_only','paywalled')
  ),
  open_access boolean not null default false,
  verification_status text not null default 'unverified' check (
    verification_status in ('verified','unverified','failed','stale')
  ),
  verification_http_status int,
  verification_checked_at timestamptz,
  programmes text[] not null default '{}',
  matched_terms text[] not null default '{}',
  relevance_score numeric check (relevance_score is null or relevance_score >= 0),
  dedupe_key text not null,
  first_indexed_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  is_active boolean not null default true,
  raw_metadata jsonb,
  unique (source_provider, external_id)
);

create index if not exists idx_scholarly_resources_programmes
  on public.scholarly_resources using gin (programmes);
create index if not exists idx_scholarly_resources_year
  on public.scholarly_resources (publication_year);
create index if not exists idx_scholarly_resources_type
  on public.scholarly_resources (resource_type);
create index if not exists idx_scholarly_resources_provider
  on public.scholarly_resources (source_provider);
create index if not exists idx_scholarly_resources_verification
  on public.scholarly_resources (verification_status);
create index if not exists idx_scholarly_resources_programme_year
  on public.scholarly_resources (programmes, publication_year);
create index if not exists idx_scholarly_resources_dedupe
  on public.scholarly_resources (dedupe_key);

create table if not exists public.resource_sync_state (
  provider text not null,
  programme_slug text not null,
  cursor text,
  last_run_at timestamptz,
  last_status text not null default 'never' check (
    last_status in ('never','ok','rate_limited','error')
  ),
  records_fetched int not null default 0,
  records_upserted int not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (provider, programme_slug)
);

alter table public.scholarly_resources enable row level security;
alter table public.resource_sync_state enable row level security;

drop policy if exists "scholarly_resources_read_anon" on public.scholarly_resources;
drop policy if exists "scholarly_resources_read_auth" on public.scholarly_resources;

create policy "scholarly_resources_read_anon"
  on public.scholarly_resources for select to anon
  using (is_active = true);

create policy "scholarly_resources_read_auth"
  on public.scholarly_resources for select to authenticated
  using (is_active = true);

grant select on public.scholarly_resources to anon, authenticated;
revoke all on public.resource_sync_state from anon, authenticated;
