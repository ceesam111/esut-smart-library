-- T05: scheduled visibility & indexing diagnostics (sitemap coverage, metadata gaps,
-- duplicate titles, crawlability probes, DOI link checks). Runs DB-only in the worker;
-- librarians can request a deep check with live crawl probes from the admin API.
insert into public.agent_schedules (label, job_type, agent_name, payload, priority, enabled, interval_minutes, next_run_at)
select 'Daily visibility & indexing diagnostics', 'visibility.diagnostics', 'Sysa', '{}'::jsonb, 6, true, 1440, now() + interval '3 hours'
where not exists (
  select 1 from public.agent_schedules where job_type = 'visibility.diagnostics'
);

select label, job_type, enabled, interval_minutes
from public.agent_schedules where job_type = 'visibility.diagnostics';
