-- Batch 8: periodic search reindex sweep
insert into public.agent_schedules (label, job_type, agent_name, enabled, interval_minutes, payload)
values ('Search reindex sweep', 'search.reindexProducer', 'search-indexer', true, 60, '{}'::jsonb)
on conflict do nothing;

update public.agent_schedules
set enabled = true,
    interval_minutes = 60,
    job_type = 'search.reindexProducer',
    agent_name = 'search-indexer'
where job_type = 'search.reindexProducer';

select 'schedule' as object, label, job_type, enabled, interval_minutes
from public.agent_schedules where job_type = 'search.reindexProducer';
