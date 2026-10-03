create table if not exists marc_batch_modification_audit (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  operation text not null,
  rule_config jsonb not null default '{}',
  affected_record_ids uuid[] not null default '{}',
  success_count integer not null default 0,
  failure_count integer not null default 0,
  change_data jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table marc_batch_modification_audit enable row level security;

create policy "marc_batch_audit_read" on marc_batch_modification_audit for select to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "marc_batch_audit_write" on marc_batch_modification_audit for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
