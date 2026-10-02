create table if not exists public.oai_request_log (
  id uuid primary key default gen_random_uuid(),
  verb text not null,
  metadata_prefix text,
  set_filter text,
  resumption_token boolean not null default false,
  error_code text,
  record_count integer not null default 0,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_oai_request_log_created_at on public.oai_request_log(created_at);
create index if not exists idx_oai_request_log_verb on public.oai_request_log(verb);

comment on table public.oai_request_log is 'OAI-PMH request telemetry. Never stores record metadata or identifiers.';

select 'oai_request_log' as object, count(*) as present
from information_schema.tables
where table_schema='public' and table_name='oai_request_log';
