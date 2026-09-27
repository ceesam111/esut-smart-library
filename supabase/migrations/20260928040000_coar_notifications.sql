-- WAVE 5: COAR Notify notifications table
create table if not exists public.coar_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_id text not null,
  type text[] not null,
  actor_id text,
  object_id text,
  target_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coar_notifications_object on public.coar_notifications(object_id);

alter table public.coar_notifications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='coar_notifications' and policyname='coar_notifications_insert') then
    create policy "coar_notifications_insert" on public.coar_notifications for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='coar_notifications' and policyname='coar_notifications_select_staff') then
    create policy "coar_notifications_select_staff" on public.coar_notifications for select to authenticated using (true);
  end if;
end $$;
