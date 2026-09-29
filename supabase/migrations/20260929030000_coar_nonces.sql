-- COAR Notify persistent nonce tracking for replay protection
create table if not exists public.coar_nonces (
  nonce text primary key,
  created_at timestamptz not null default now()
);

create index if not exists idx_coar_nonces_created on public.coar_nonces(created_at desc);

alter table public.coar_nonces enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='coar_nonces' and policyname='coar_nonces_service_insert') then
    create policy "coar_nonces_service_insert" on public.coar_nonces for insert to service_role with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='coar_nonces' and policyname='coar_nonces_service_delete') then
    create policy "coar_nonces_service_delete" on public.coar_nonces for delete to service_role using (true);
  end if;
end $$;
