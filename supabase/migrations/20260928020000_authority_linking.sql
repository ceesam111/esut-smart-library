-- WAVE 3: authority control linking
alter table if exists public.catalogue_items add column if not exists authority_id uuid;
alter table if exists public.catalogue_items add column if not exists authority_heading text;

alter table if exists public.repository_items add column if not exists authority_id uuid;
alter table if exists public.repository_items add column if not exists authority_heading text;

create index if not exists idx_catalogue_items_authority on public.catalogue_items(authority_id);
create index if not exists idx_repository_items_authority on public.repository_items(authority_id);
