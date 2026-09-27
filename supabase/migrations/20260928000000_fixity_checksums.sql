-- WAVE 2: checksums and fixity for digital preservation
alter table if exists public.repository_items add column if not exists checksum text;
alter table if exists public.repository_items add column if not exists checksum_algorithm text default 'sha256';

create table if not exists public.fixity_checks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.repository_items(id) on delete cascade,
  file_url text not null,
  expected_checksum text not null,
  actual_checksum text,
  status text not null default 'pending' check (status in ('pending', 'passed', 'failed', 'error')),
  error_message text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_fixity_checks_item on public.fixity_checks(item_id);
create index if not exists idx_fixity_checks_status on public.fixity_checks(status);

alter table public.fixity_checks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='fixity_checks' and policyname='fixity_checks_insert') then
    create policy "fixity_checks_insert" on public.fixity_checks for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='fixity_checks' and policyname='fixity_checks_select_staff') then
    create policy "fixity_checks_select_staff" on public.fixity_checks for select to authenticated using (true);
  end if;
end $$;
