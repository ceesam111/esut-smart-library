-- Batch 8: full-text extraction storage, access-aware search index, server-side search RPC.
-- Target project: rnnjspkdhoigncdgmy

begin;

-- ---------------------------------------------------------------------------
-- 1. Extracted text storage on repository_files
--    (extracted_text did not exist before this migration; the previous
--     extraction code wrote to it and therefore always failed)
-- ---------------------------------------------------------------------------
alter table public.repository_files add column if not exists extracted_text text;
alter table public.repository_files add column if not exists extracted_at timestamptz;
alter table public.repository_files add column if not exists extraction_error text;
alter table public.repository_files add column if not exists extraction_duration_ms integer;
alter table public.repository_files add column if not exists ocr_status text;

comment on column public.repository_files.extracted_text is 'Extracted plain text used for access-aware full-text search.';
comment on column public.repository_files.extraction_error is 'Last extraction failure reason, or null.';
comment on column public.repository_files.ocr_status is 'OCR outcome for documents without a text layer.';

-- ---------------------------------------------------------------------------
-- 2. Access-aware search index: one row per (item, file)
--    Each row carries its own access level and embargo so the search RPC can
--    filter per caller. Item metadata is denormalized onto every row.
-- ---------------------------------------------------------------------------
create table if not exists public.repository_search_documents (
  id uuid primary key default gen_random_uuid(),
  repository_item_id uuid not null references public.repository_items(id) on delete cascade,
  repository_file_id uuid references public.repository_files(id) on delete cascade,
  repository_version_id uuid references public.repository_versions(id) on delete set null,
  uploader_id uuid,
  title text,
  authors jsonb not null default '[]'::jsonb,
  subjects jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  abstract text,
  file_name text,
  file_text text,
  access_level text not null default 'PUBLIC',
  embargo_until timestamptz,
  is_current_version boolean not null default true,
  extraction_status text not null default 'pending',
  search_vector tsvector,
  last_indexed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_repository_search_documents_vector
  on public.repository_search_documents using gin(search_vector);
create index if not exists idx_repository_search_documents_item
  on public.repository_search_documents(repository_item_id);
create index if not exists idx_repository_search_documents_file
  on public.repository_search_documents(repository_file_id);

comment on table public.repository_search_documents is
  'Access-aware full-text index for repository items. One row per file plus one metadata-only row per item.';

-- ---------------------------------------------------------------------------
-- 3. Vector maintenance
--    A = title, B = authors/subjects/keywords, C = abstract, D = file text
-- ---------------------------------------------------------------------------
create or replace function public.jsonb_array_to_text(p jsonb)
returns text[]
language sql
immutable
parallel safe
as $$
  select coalesce(array_agg(value), '{}') from jsonb_array_elements_text(p) as value;
$$;

create or replace function public.repository_search_documents_vector_refresh()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english',
      coalesce(array_to_string(public.jsonb_array_to_text(new.authors), ' '), '') || ' ' ||
      coalesce(array_to_string(public.jsonb_array_to_text(new.subjects), ' '), '') || ' ' ||
      coalesce(array_to_string(public.jsonb_array_to_text(new.keywords), ' '), '')
    ), 'B') ||
    setweight(to_tsvector('english', coalesce(new.abstract, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.file_text, '')), 'D');
  return new;
end;
$$;

drop trigger if exists trg_repository_search_documents_vector on public.repository_search_documents;
create trigger trg_repository_search_documents_vector
before insert or update on public.repository_search_documents
for each row execute function public.repository_search_documents_vector_refresh();

-- ---------------------------------------------------------------------------
-- 4. RLS. The search RPC is SECURITY DEFINER and applies access control itself,
--    so the table is closed to direct access.
-- ---------------------------------------------------------------------------
alter table public.repository_search_documents enable row level security;

drop policy if exists "search_documents_service_role" on public.repository_search_documents;
create policy "search_documents_service_role"
  on public.repository_search_documents
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 5. Access-aware search RPC
-- ---------------------------------------------------------------------------
create or replace function public.repository_search(
  p_query text default null,
  p_faculty text[] default null,
  p_department text[] default null,
  p_years int[] default null,
  p_resource_types text[] default null,
  p_subjects text[] default null,
  p_access_levels text[] default null,
  p_sort text default 'relevance',
  p_page int default 1,
  p_page_size int default 25,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_faculty_code text;
  v_tsquery tsquery := null;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_page_size int := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset int := (v_page - 1) * v_page_size;
  v_total int;
  v_total_pages int;
  v_items jsonb;
  v_facets jsonb;
  v_sort text := case lower(coalesce(p_sort, 'relevance'))
    when 'relevance' then 'relevance'
    when 'newest' then 'newest'
    when 'oldest' then 'oldest'
    when 'title' then 'title'
    else 'relevance'
  end;
begin
  v_is_admin := public.is_library_admin(p_user_id);

  if p_user_id is not null and not v_is_admin then
    select p.faculty_code into v_faculty_code
    from public.patrons p
    where p.user_id = p_user_id;
  end if;

  if p_query is not null and btrim(p_query) <> '' then
    v_tsquery := websearch_to_tsquery('english', p_query);
    if v_tsquery is null or v_tsquery::text = '' then
      v_tsquery := null;
    end if;
  end if;

  drop table if exists _repo_search_work;
  create temp table _repo_search_work on commit drop as
  select distinct on (rows.repository_item_id)
    rows.repository_item_id,
    rows.document_id,
    rows.title,
    rows.authors,
    rows.subjects,
    rows.keywords,
    rows.abstract,
    rows.file_name,
    rows.file_text,
    rows.access_level,
    rows.is_current_version,
    rows.extraction_status,
    rows.created_at,
    rows.year,
    rows.item_type,
    rows.type,
    rows.faculty_code,
    rows.department,
    rows.doi,
    rows.handle,
    rows.license,
    rows.rank
  from (
    select
      d.repository_item_id,
      d.id as document_id,
      d.title,
      d.authors,
      d.subjects,
      d.keywords,
      d.abstract,
      d.file_name,
      d.file_text,
      d.access_level,
      d.is_current_version,
      d.extraction_status,
      i.created_at,
      i.year,
      i.item_type,
      i.type,
      i.faculty_code,
      i.department,
      i.doi,
      i.handle,
      i.license,
      ts_rank(d.search_vector, coalesce(v_tsquery, to_tsquery('english', ''))) as rank
    from public.repository_search_documents d
    join public.repository_items i on i.id = d.repository_item_id
    where i.status = 'published'
      and (
        i.visibility = 'global'
        or (i.visibility = 'faculty' and p_user_id is not null
            and (v_is_admin or (v_faculty_code is not null and v_faculty_code = i.faculty_code)))
        or (i.visibility = 'private' and (v_is_admin or i.submitter_id = p_user_id))
      )
      and (i.embargo_until is null or i.embargo_until <= now() or v_is_admin or i.submitter_id = p_user_id)
      and (
        d.access_level = 'PUBLIC'
        or (d.access_level = 'AUTHENTICATED' and p_user_id is not null)
        or (d.access_level = 'FACULTY' and p_user_id is not null
            and (v_is_admin or (v_faculty_code is not null and v_faculty_code = i.faculty_code)))
        or (d.access_level = 'RESTRICTED' and v_is_admin)
        or (d.access_level = 'PRIVATE' and (v_is_admin or d.uploader_id = p_user_id))
      )
      and (d.embargo_until is null or d.embargo_until <= now() or v_is_admin or d.uploader_id = p_user_id)
      and (v_tsquery is null or d.search_vector @@ v_tsquery)
      and (p_faculty is null or i.faculty_code = any(p_faculty))
      and (p_department is null or i.department = any(p_department))
      and (p_years is null or i.year = any(p_years))
      and (p_resource_types is null or coalesce(nullif(i.item_type, ''), i.type) = any(p_resource_types))
      and (p_subjects is null or exists (
            select 1 from jsonb_array_elements_text(i.subjects) s where s = any(p_subjects)))
      and (p_access_levels is null or d.access_level = any(p_access_levels))
  ) rows
  order by rows.repository_item_id, rows.is_current_version desc, rows.rank desc, rows.document_id;

  select count(*) into v_total from _repo_search_work;
  v_total_pages := ceil(v_total::numeric / v_page_size);

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb) into v_items
  from (
    select
      w.repository_item_id as id,
      w.title,
      w.authors,
      w.subjects,
      w.keywords,
      w.abstract,
      w.year,
      coalesce(nullif(w.item_type, ''), w.type) as "resourceType",
      nullif(w.faculty_code, '') as "facultyCode",
      nullif(w.department, '') as "department",
      w.doi,
      w.handle,
      w.license,
      w.created_at as "createdAt",
      round(w.rank::numeric, 6) as score,
      (
        select jsonb_agg(field order by ord)
        from (
          select 'title' as field, 1 as ord
            where ts_headline('english', coalesce(w.title, ''), coalesce(v_tsquery, to_tsquery('english',''))) like '%<b>%'
          union all
          select 'author', 2
            where ts_headline('english', coalesce(array_to_string(public.jsonb_array_to_text(w.authors), ' '), ''), coalesce(v_tsquery, to_tsquery('english',''))) like '%<b>%'
          union all
          select 'subject', 3
            where ts_headline('english', coalesce(array_to_string(public.jsonb_array_to_text(w.subjects), ' '), ''), coalesce(v_tsquery, to_tsquery('english',''))) like '%<b>%'
          union all
          select 'abstract', 4
            where ts_headline('english', coalesce(w.abstract, ''), coalesce(v_tsquery, to_tsquery('english',''))) like '%<b>%'
          union all
          select 'fullText', 5
            where ts_headline('english', left(coalesce(w.file_text, ''), 50000), coalesce(v_tsquery, to_tsquery('english',''))) like '%<b>%'
        ) m
      ) as "matchedIn",
      nullif(regexp_replace(
        coalesce(
          case
            when ts_headline('english', coalesce(w.abstract, ''), coalesce(v_tsquery, to_tsquery('english','')), 'MaxFragments=2,MaxWords=14,MinWords=4') like '%<b>%'
            then ts_headline('english', coalesce(w.abstract, ''), coalesce(v_tsquery, to_tsquery('english','')), 'MaxFragments=2,MaxWords=14,MinWords=4')
          end,
          case
            when ts_headline('english', left(coalesce(w.file_text, ''), 50000), coalesce(v_tsquery, to_tsquery('english','')), 'MaxFragments=2,MaxWords=14,MinWords=4') like '%<b>%'
            then ts_headline('english', left(coalesce(w.file_text, ''), 50000), coalesce(v_tsquery, to_tsquery('english','')), 'MaxFragments=2,MaxWords=14,MinWords=4')
          end,
          left(coalesce(w.abstract, ''), 200)
        ),
        '</?b>', ' ', 'g'
      ), '') as snippet,
      case
        when w.file_name is null then null
        else jsonb_build_object('name', w.file_name, 'accessLevel', w.access_level, 'extractionStatus', w.extraction_status)
      end as file
    from _repo_search_work w
    order by
      case when v_sort = 'newest' then w.created_at end desc,
      case when v_sort = 'oldest' then w.created_at end asc,
      case when v_sort = 'title' then w.title end asc,
      w.rank desc
    limit v_page_size offset v_offset
  ) sub;

  select jsonb_build_object(
    'resourceType', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc), '[]'::jsonb)
      from (
        select coalesce(nullif(w.item_type, ''), w.type) as value, count(*) as count
        from _repo_search_work w group by 1
      ) t
    ),
    'year', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', count) order by value desc), '[]'::jsonb)
      from (
        select w.year::text as value, count(*) as count
        from _repo_search_work w where w.year is not null group by 1
      ) t
    ),
    'faculty', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc), '[]'::jsonb)
      from (
        select w.faculty_code as value, count(*) as count
        from _repo_search_work w where nullif(w.faculty_code, '') is not null group by 1
      ) t
    ),
    'department', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc), '[]'::jsonb)
      from (
        select w.department as value, count(*) as count
        from _repo_search_work w where nullif(w.department, '') is not null group by 1
      ) t
    ),
    'author', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc), '[]'::jsonb)
      from (
        select a.value, count(*) as count
        from _repo_search_work w
        cross join lateral jsonb_array_elements_text(w.authors) as a(value)
        group by 1
      ) t
    ),
    'subject', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc), '[]'::jsonb)
      from (
        select s.value, count(*) as count
        from _repo_search_work w
        cross join lateral jsonb_array_elements_text(w.subjects) as s(value)
        group by 1
      ) t
    ),
    'accessLevel', (
      select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', count) order by count desc), '[]'::jsonb)
      from (
        select w.access_level as value, count(*) as count
        from _repo_search_work w group by 1
      ) t
    )
  ) into v_facets;

  return jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', v_total_pages,
    'facets', coalesce(v_facets, '{}'::jsonb),
    'query', coalesce(p_query, ''),
    'sort', v_sort
  );
end;
$$;

comment on function public.repository_search(text, text[], text[], int[], text[], text[], text[], text, int, int, uuid) is
  'Access-aware repository full-text search with server-side facets, ranking, pagination and snippets.';

-- ---------------------------------------------------------------------------
-- 6. Reindex triggers: enqueue a search.reindex job when content or access changes
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_search_reindex(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agent_jobs (tenant_id, job_type, agent_name, status, priority, payload, max_attempts)
  values (
    public.default_tenant_id(),
    'search.reindex',
    'search-indexer',
    'pending',
    6,
    jsonb_build_object('repositoryItemId', p_item_id, 'reason', 'content_or_access_change'),
    3
  )
  on conflict do nothing;
end;
$$;

create or replace function public.trg_repository_files_search_reindex()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_search_reindex(new.repository_item_id);
  return null;
end;
$$;

create or replace function public.trg_repository_items_search_reindex()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_search_reindex(new.id);
  return null;
end;
$$;

drop trigger if exists trg_repository_files_search_reindex on public.repository_files;
create trigger trg_repository_files_search_reindex
after insert or update of extracted_text, extracted_text_status, access_level, embargo_until, preservation_status
on public.repository_files
for each row execute function public.trg_repository_files_search_reindex();

drop trigger if exists trg_repository_items_search_reindex on public.repository_items;
create trigger trg_repository_items_search_reindex
after insert or update of title, abstract, authors, subjects, keywords, visibility, status, embargo_until, faculty_code, department, item_type, type
on public.repository_items
for each row execute function public.trg_repository_items_search_reindex();

-- ---------------------------------------------------------------------------
-- 7. Backfill: build search documents for existing published items
-- ---------------------------------------------------------------------------
insert into public.repository_search_documents (
  repository_item_id, repository_file_id, repository_version_id, uploader_id,
  title, authors, subjects, keywords, abstract,
  file_name, file_text, access_level, embargo_until, is_current_version, extraction_status
)
select
  i.id,
  f.id,
  f.repository_version_id,
  f.uploader_id,
  i.title,
  i.authors,
  i.subjects,
  i.keywords,
  i.abstract,
  coalesce(f.display_filename, f.original_filename),
  left(coalesce(f.extracted_text, ''), 2000000),
  f.access_level,
  coalesce(f.embargo_until, i.embargo_until),
  f.repository_version_id is null
    or f.repository_version_id = (
      select v.id from public.repository_versions v
      where v.repository_item_id = i.id
      order by v.version_number desc limit 1
    ),
  f.extracted_text_status
from public.repository_items i
join public.repository_files f on f.repository_item_id = i.id
on conflict do nothing;

insert into public.repository_search_documents (
  repository_item_id, repository_file_id, uploader_id,
  title, authors, subjects, keywords, abstract,
  access_level, embargo_until, is_current_version, extraction_status
)
select
  i.id,
  null,
  i.submitter_id,
  i.title,
  i.authors,
  i.subjects,
  i.keywords,
  i.abstract,
  'PUBLIC',
  i.embargo_until,
  true,
  'not_required'
from public.repository_items i
where not exists (
  select 1 from public.repository_search_documents d where d.repository_item_id = i.id
);

commit;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
select 'repository_files.extracted_text' as object, count(*) as present
from information_schema.columns
where table_schema='public' and table_name='repository_files' and column_name='extracted_text';

select 'repository_search_documents' as object, count(*) as rows
from public.repository_search_documents;

select 'repository_search function' as object, count(*) as present
from information_schema.routines
where routine_schema='public' and routine_name='repository_search';
