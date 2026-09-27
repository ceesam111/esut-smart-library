-- WAVE 4: serials claims for missing issues
create table if not exists public.serials_claims (
  id uuid primary key default gen_random_uuid(),
  serial_id uuid not null references public.serials_subscriptions(id) on delete cascade,
  issue_number text not null,
  volume text,
  status text not null default 'pending' check (status in ('pending', 'notified', 'resolved', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_serials_claims_serial on public.serials_claims(serial_id);
create index if not exists idx_serials_claims_status on public.serials_claims(status);

alter table public.serials_claims enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='serials_claims' and policyname='serials_claims_insert') then
    create policy "serials_claims_insert" on public.serials_claims for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='serials_claims' and policyname='serials_claims_select_staff') then
    create policy "serials_claims_select_staff" on public.serials_claims for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='serials_claims' and policyname='serials_claims_update_staff') then
    create policy "serials_claims_update_staff" on public.serials_claims for update to authenticated using (true) with check (true);
  end if;
end $$;
