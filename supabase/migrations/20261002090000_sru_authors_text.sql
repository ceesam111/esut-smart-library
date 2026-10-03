-- Batch 10: SRU search text columns
-- catalogue_items.authors is jsonb; SRU CQL dc.creator needs a text column for ILIKE search.

alter table catalogue_items add column if not exists authors_text text;

update catalogue_items
set authors_text = (
  select coalesce(
    string_agg(
      case
        when jsonb_typeof(value) = 'string' then trim(both '"' from value::text)
        else coalesce(value->>'name', '')
      end,
      '; '
    ),
    ''
  )
  from jsonb_array_elements(coalesce(authors, '[]'::jsonb)) as value
)
where authors_text is null;

update catalogue_items
set subjects_text = (
  select coalesce(string_agg(trim(both '"' from value::text), '; '), '')
  from jsonb_array_elements(coalesce(subjects, '[]'::jsonb)) as value
)
where subjects_text is null and subjects is not null;

-- keep authors_text in sync on insert/update
create or replace function public.sync_authors_text()
returns trigger language plpgsql as $$
begin
  new.authors_text := (
    select coalesce(
      string_agg(
        case
          when jsonb_typeof(value) = 'string' then trim(both '"' from value::text)
          else coalesce(value->>'name', '')
        end,
        '; '
      ),
      ''
    )
    from jsonb_array_elements(coalesce(new.authors, '[]'::jsonb)) as value
  );
  new.subjects_text := (
    select coalesce(string_agg(trim(both '"' from value::text), '; '), '')
    from jsonb_array_elements(coalesce(new.subjects, '[]'::jsonb)) as value
  );
  return new;
end;
$$;

drop trigger if exists trg_catalogue_items_authors_text on public.catalogue_items;
create trigger trg_catalogue_items_authors_text
  before insert or update of authors, subjects on public.catalogue_items
  for each row execute function public.sync_authors_text();

select 'authors_text' as object,
  count(*) as present
from information_schema.columns
where table_schema = 'public' and table_name = 'catalogue_items' and column_name = 'authors_text';
