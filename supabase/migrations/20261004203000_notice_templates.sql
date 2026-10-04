create table if not exists notice_templates (
  id text primary key,
  notice_type text not null,
  name text not null,
  subject text not null,
  body_text text not null,
  body_html text,
  channel text not null default 'email' check (channel in ('email', 'in-app', 'print')),
  locale text not null default 'en',
  enabled boolean not null default true,
  variables jsonb not null default '{}',
  tenant_id text,
  library_id text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table notice_templates enable row level security;

drop policy if exists "notice_templates_admin" on notice_templates;
create policy "notice_templates_admin" on notice_templates for all to authenticated using (
  exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('super_admin', 'librarian', 'faculty_librarian', 'catalog_admin')
  )
);

create index idx_notice_templates_type on notice_templates(notice_type);
create index idx_notice_templates_enabled on notice_templates(enabled);

create or replace function set_notice_templates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notice_templates_updated_at on notice_templates;
create trigger trg_notice_templates_updated_at
  before update on notice_templates
  for each row execute function set_notice_templates_updated_at();
