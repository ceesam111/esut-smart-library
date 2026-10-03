-- MARC Frameworks
create table if not exists marc_frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marc_framework_fields (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references marc_frameworks(id) on delete cascade,
  tag text not null,
  subfield_code text not null,
  label text not null,
  is_visible boolean not null default true,
  is_required boolean not null default false,
  is_repeatable boolean not null default false,
  default_value text,
  validation_rules jsonb not null default '{}',
  help_text text,
  sort_order integer not null default 0,
  is_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(framework_id, tag, subfield_code)
);

-- Staged MARC Import
create table if not exists marc_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  filename text,
  status text not null default 'PENDING',
  record_count integer not null default 0,
  valid_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marc_import_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references marc_import_batches(id) on delete cascade,
  record_position integer not null,
  raw_marcxml text,
  parsed_marc jsonb,
  title text,
  authors text[],
  isbn text,
  issn text,
  validation_result jsonb not null default '{}',
  duplicate_status text not null default 'NO_MATCH',
  duplicate_candidates jsonb not null default '[]',
  status text not null default 'PENDING',
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Overlay Rules
create table if not exists marc_overlay_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  framework_id uuid references marc_frameworks(id) on delete cascade,
  tag text not null,
  subfield_code text,
  action text not null check (action in ('replace','preserve','append','protect')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marc_overlay_audit (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references marc_import_batches(id) on delete set null,
  source_record_id uuid,
  target_record_id uuid references catalogue_items(id) on delete set null,
  ruleset_id uuid references marc_overlay_rules(id) on delete set null,
  fields_changed jsonb not null default '[]',
  fields_preserved jsonb not null default '[]',
  performed_by uuid references auth.users(id) on delete set null,
  performed_at timestamptz not null default now()
);

-- Authority Control Enhancements
alter table authority_control add column if not exists preferred_heading text;
alter table authority_control add column if not exists see_references text[] default '{}';
alter table authority_control add column if not exists see_also uuid[] default '{}';
alter table authority_control add column if not exists identifiers jsonb default '{}';
alter table authority_control add column if not exists source text;
alter table authority_control add column if not exists status text not null default 'active';
alter table authority_control add column if not exists merged_into uuid;

-- Authority Merge History
create table if not exists authority_merge_history (
  id uuid primary key default gen_random_uuid(),
  source_authority_id uuid not null references authority_control(id) on delete cascade,
  target_authority_id uuid not null references authority_control(id) on delete cascade,
  merged_by uuid references auth.users(id) on delete set null,
  bibliographic_count integer not null default 0,
  merged_at timestamptz not null default now()
);

-- Item-Authority Links (many-to-many)
create table if not exists item_authority_links (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references catalogue_items(id) on delete cascade,
  authority_id uuid not null references authority_control(id) on delete cascade,
  field_tag text not null,
  field_subfield text,
  created_at timestamptz not null default now(),
  unique(item_id, authority_id, field_tag, field_subfield)
);

-- RLS
alter table marc_frameworks enable row level security;
alter table marc_framework_fields enable row level security;
alter table marc_import_batches enable row level security;
alter table marc_import_records enable row level security;
alter table marc_overlay_rules enable row level security;
alter table marc_overlay_audit enable row level security;
alter table authority_merge_history enable row level security;
alter table item_authority_links enable row level security;

-- Policies
create policy "marc_frameworks_read" on marc_frameworks for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_frameworks_write" on marc_frameworks for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_framework_fields_read" on marc_framework_fields for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_framework_fields_write" on marc_framework_fields for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_import_batches_read" on marc_import_batches for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_import_batches_write" on marc_import_batches for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_import_records_read" on marc_import_records for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_import_records_write" on marc_import_records for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_overlay_rules_read" on marc_overlay_rules for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_overlay_rules_write" on marc_overlay_rules for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_overlay_audit_read" on marc_overlay_audit for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_overlay_audit_write" on marc_overlay_audit for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "authority_merge_history_read" on authority_merge_history for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "authority_merge_history_write" on authority_merge_history for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "item_authority_links_read" on item_authority_links for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "item_authority_links_write" on item_authority_links for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

-- Seed default frameworks
insert into marc_frameworks (code, name, description) values
  ('BOOK', 'Book', 'Monograph and book cataloguing'),
  ('SERIAL', 'Serial', 'Serial and periodical cataloguing'),
  ('THESIS', 'Thesis', 'Thesis and dissertation cataloguing'),
  ('ELECTRONIC_RESOURCE', 'Electronic Resource', 'Electronic resource cataloguing')
on conflict do nothing;

-- Seed BOOK framework fields
insert into marc_framework_fields (framework_id, tag, subfield_code, label, is_required, is_repeatable, sort_order, help_text)
select f.id, t.tag, t.subfield, t.label, t.required, t.repeatable, t.sort, t.help
from marc_frameworks f
cross join (values
  ('020', 'a', 'ISBN', true, false, 1, 'International Standard Book Number'),
  ('022', 'a', 'ISSN', false, false, 2, 'International Standard Serial Number'),
  ('100', 'a', 'Main Entry - Personal Name', false, false, 3, 'Primary author'),
  ('245', 'a', 'Title', true, false, 4, 'Title proper'),
  ('245', 'b', 'Remainder of Title', false, false, 5, 'Subtitle'),
  ('245', 'c', 'Statement of Responsibility', false, false, 6, 'Author statement'),
  ('250', 'a', 'Edition Statement', false, false, 7, 'Edition'),
  ('260', 'a', 'Place of Publication', false, false, 8, 'Publication place'),
  ('260', 'b', 'Publisher', false, false, 9, 'Publisher name'),
  ('260', 'c', 'Date of Publication', false, false, 10, 'Publication year'),
  ('300', 'a', 'Physical Description', false, false, 11, 'Extent'),
  ('520', 'a', 'Summary', false, false, 12, 'Abstract or summary'),
  ('650', 'a', 'Subject Heading', false, true, 13, 'Topical subject'),
  ('700', 'a', 'Added Entry - Personal Name', false, true, 14, 'Additional author')
) as t(tag, subfield, label, required, repeatable, sort, help)
where f.code = 'BOOK';

-- Seed SERIAL framework fields
insert into marc_framework_fields (framework_id, tag, subfield_code, label, is_required, is_repeatable, sort_order, help_text)
select f.id, t.tag, t.subfield, t.label, t.required, t.repeatable, t.sort, t.help
from marc_frameworks f
cross join (values
  ('022', 'a', 'ISSN', true, false, 1, 'International Standard Serial Number'),
  ('245', 'a', 'Title', true, false, 2, 'Title proper'),
  ('245', 'b', 'Remainder of Title', false, false, 3, 'Subtitle'),
  ('260', 'a', 'Place of Publication', false, false, 4, 'Publication place'),
  ('260', 'b', 'Publisher', false, false, 5, 'Publisher name'),
  ('300', 'a', 'Physical Description', false, false, 6, 'Extent'),
  ('362', 'a', 'Dates of Publication', false, false, 7, 'Publication dates'),
  ('520', 'a', 'Summary', false, false, 8, 'Abstract or summary'),
  ('650', 'a', 'Subject Heading', false, true, 9, 'Topical subject')
) as t(tag, subfield, label, required, repeatable, sort, help)
where f.code = 'SERIAL';

-- Seed THESIS framework fields
insert into marc_framework_fields (framework_id, tag, subfield_code, label, is_required, is_repeatable, sort_order, help_text)
select f.id, t.tag, t.subfield, t.label, t.required, t.repeatable, t.sort, t.help
from marc_frameworks f
cross join (values
  ('100', 'a', 'Author', true, false, 1, 'Thesis author'),
  ('245', 'a', 'Title', true, false, 2, 'Title proper'),
  ('250', 'a', 'Degree', false, false, 3, 'Degree statement'),
  ('260', 'a', 'Place', false, false, 4, 'Publication place'),
  ('260', 'b', 'Institution', false, false, 5, 'Degree-granting institution'),
  ('260', 'c', 'Year', false, false, 6, 'Year'),
  ('300', 'a', 'Physical Description', false, false, 7, 'Extent'),
  ('520', 'a', 'Summary', false, false, 8, 'Abstract'),
  ('650', 'a', 'Subject Heading', false, true, 9, 'Topical subject'),
  ('700', 'a', 'Supervisor', false, true, 10, 'Thesis supervisor')
) as t(tag, subfield, label, required, repeatable, sort, help)
where f.code = 'THESIS';

-- Seed ELECTRONIC_RESOURCE framework fields
insert into marc_framework_fields (framework_id, tag, subfield_code, label, is_required, is_repeatable, sort_order, help_text)
select f.id, t.tag, t.subfield, t.label, t.required, t.repeatable, t.sort, t.help
from marc_frameworks f
cross join (values
  ('020', 'a', 'ISBN', false, false, 1, 'International Standard Book Number'),
  ('022', 'a', 'ISSN', false, false, 2, 'International Standard Serial Number'),
  ('245', 'a', 'Title', true, false, 3, 'Title proper'),
  ('260', 'a', 'Place', false, false, 4, 'Publication place'),
  ('260', 'b', 'Publisher', false, false, 5, 'Publisher name'),
  ('336', 'a', 'Content Type', false, false, 6, 'Content type term'),
  ('337', 'a', 'Media Type', false, false, 7, 'Media type term'),
  ('338', 'a', 'Carrier Type', false, false, 8, 'Carrier type term'),
  ('520', 'a', 'Summary', false, false, 9, 'Abstract or summary'),
  ('650', 'a', 'Subject Heading', false, true, 10, 'Topical subject'),
  ('856', 'u', 'URI', false, true, 11, 'Electronic location')
) as t(tag, subfield, label, required, repeatable, sort, help)
where f.code = 'ELECTRONIC_RESOURCE';

-- Seed default overlay rules
insert into marc_overlay_rules (name, tag, subfield_code, action) values
  ('Protect local 9xx fields', '9', null, 'protect'),
  ('Replace 245 title', '245', 'a', 'replace'),
  ('Replace 100 author', '100', 'a', 'replace'),
  ('Preserve local holdings', '852', null, 'preserve'),
  ('Append 650 subjects', '650', 'a', 'append')
on conflict do nothing;
