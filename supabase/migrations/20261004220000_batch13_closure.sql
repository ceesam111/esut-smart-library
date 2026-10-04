-- Batch 13C closure: structured report scheduling, scheduled run states, and duplicate-run protection.

alter table saved_reports
  add column if not exists schedule_frequency text check (schedule_frequency in ('daily', 'weekly', 'monthly')),
  add column if not exists schedule_time text not null default '08:00',
  add column if not exists schedule_day int check (schedule_day >= 0 and schedule_day <= 31),
  add column if not exists schedule_delivery text not null default 'in_app' check (schedule_delivery in ('in_app', 'email')),
  add column if not exists schedule_next_run_at timestamptz,
  add column if not exists schedule_last_run_at timestamptz,
  add column if not exists schedule_last_status text;

alter table report_run_history
  drop constraint if exists report_run_history_status_check;

alter table report_run_history
  add column if not exists schedule_period_key text,
  add column if not exists artifact_content text,
  add column if not exists artifact_name text,
  add column if not exists delivery_detail text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'report_run_history_status_check'
      and conrelid = 'public.report_run_history'::regclass
  ) then
    alter table report_run_history
      add constraint report_run_history_status_check
      check (status in ('pending', 'running', 'completed', 'failed', 'suppressed'));
  end if;
end $$;

create unique index if not exists uq_report_run_history_period
  on report_run_history(report_id, schedule_period_key)
  where schedule_period_key is not null;

create index if not exists idx_report_run_history_started on report_run_history(started_at desc);

create index if not exists idx_saved_reports_due_schedule
  on saved_reports(schedule_next_run_at)
  where schedule_enabled;
