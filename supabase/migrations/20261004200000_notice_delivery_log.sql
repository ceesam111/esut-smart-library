create table if not exists notice_delivery_log (
  id uuid primary key default gen_random_uuid(),
  notice_type text not null,
  template_id text,
  template_version int,
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_email text,
  channel text not null check (channel in ('email', 'in-app', 'print', 'sms')),
  entity_type text,
  entity_id text,
  idempotency_key text unique not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED', 'SUPPRESSED')),
  provider text,
  provider_message_id text,
  error_category text,
  error_detail text,
  retry_count int not null default 0,
  max_retries int not null default 3,
  suppression_reason text,
  context_json jsonb,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notice_delivery_log enable row level security;

create policy "notice_delivery_log_admin" on notice_delivery_log for all to authenticated using (
  exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('super_admin', 'librarian', 'admin')
  )
);

create index idx_notice_delivery_log_recipient on notice_delivery_log(recipient_user_id, created_at desc);
create index idx_notice_delivery_log_type on notice_delivery_log(notice_type, created_at desc);
create index idx_notice_delivery_log_status on notice_delivery_log(status, created_at desc);
create index idx_notice_delivery_log_idempotency on notice_delivery_log(idempotency_key);

create or replace function set_notice_delivery_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notice_delivery_updated_at on notice_delivery_log;
create trigger trg_notice_delivery_updated_at
  before update on notice_delivery_log
  for each row execute function set_notice_delivery_updated_at();
