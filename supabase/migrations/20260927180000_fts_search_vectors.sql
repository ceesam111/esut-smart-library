-- WAVE 1: full-text search for repository_items and catalogue_items
-- Adds search_vector tsvector columns with auto-update triggers and GIN indexes

-- repository_items
alter table if exists public.repository_items add column if not exists search_vector tsvector;

create or replace function public.repository_items_search_vector_refresh()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.abstract, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.keywords::text, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.department, '')), 'D');
  return new;
end;
$$;

drop trigger if exists trg_repository_items_search_vector on public.repository_items;
create trigger trg_repository_items_search_vector
before insert or update on public.repository_items
for each row execute function public.repository_items_search_vector_refresh();

create index if not exists idx_repository_items_search on public.repository_items using gin(search_vector);

-- catalogue_items
alter table if exists public.catalogue_items add column if not exists search_vector tsvector;

create or replace function public.catalogue_items_search_vector_refresh()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.authors::text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.subjects_text, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.isbn, '')), 'D');
  return new;
end;
$$;

drop trigger if exists trg_catalogue_items_search_vector on public.catalogue_items;
create trigger trg_catalogue_items_search_vector
before insert or update on public.catalogue_items
for each row execute function public.catalogue_items_search_vector_refresh();

create index if not exists idx_catalogue_items_search on public.catalogue_items using gin(search_vector);

-- Backfill existing rows
update public.repository_items set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(abstract, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(keywords::text, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(department, '')), 'D')
where search_vector is null;

update public.catalogue_items set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(authors::text, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(subjects_text, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(isbn, '')), 'D')
where search_vector is null;
