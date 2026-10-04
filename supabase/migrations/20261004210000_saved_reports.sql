create table if not exists saved_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  report_type text not null check (report_type in ('circulation', 'patrons', 'catalogue', 'repository', 'acquisitions', 'serials', 'analytics', 'fines')),
  dataset text not null,
  filters jsonb not null default '{}',
  columns jsonb not null default '[]',
  grouping jsonb,
  sorting jsonb,
  owner_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'shared', 'public')),
  schedule_cron text,
  schedule_enabled boolean not null default false,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table saved_reports enable row level security;

create policy "saved_reports_owner" on saved_reports for all to authenticated using (owner_id = auth.uid());
create policy "saved_reports_shared" on saved_reports for select to authenticated using (visibility in ('shared', 'public'));

create index idx_saved_reports_owner on saved_reports(owner_id, created_at desc);
create index idx_saved_reports_type on saved_reports(report_type);

create table if not exists report_run_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references saved_reports(id) on delete cascade,
  report_type text not null,
  triggered_by uuid references auth.users(id) on delete set null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  row_count int,
  filters jsonb,
  columns jsonb,
  output_format text,
  output_path text,
  delivery_status text,
  delivery_channel text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table report_run_history enable row level security;

create policy "report_run_history_owner" on report_run_history for all to authenticated using (
  exists (select 1 from saved_reports sr where sr.id = report_run_history.report_id and sr.owner_id = auth.uid())
);

create index idx_report_run_history_report on report_run_history(report_id, started_at desc);

create or replace function set_saved_reports_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_saved_reports_updated_at on saved_reports;
create trigger trg_saved_reports_updated_at
  before update on saved_reports
  for each row execute function set_saved_reports_updated_at();
