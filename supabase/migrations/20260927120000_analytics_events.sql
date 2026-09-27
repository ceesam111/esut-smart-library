-- WAVE 1: analytics events table for real usage tracking
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view', 'search', 'download', 'view_item', 'login', 'register')),
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  ip_hash text,
  user_agent text,
  referrer text,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_type_date on public.analytics_events(event_type, created_at desc);
create index if not exists idx_analytics_events_user on public.analytics_events(user_id, created_at desc);
create index if not exists idx_analytics_events_created on public.analytics_events(created_at desc);

alter table public.analytics_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='analytics_events' and policyname='analytics_events_insert_authenticated') then
    create policy "analytics_events_insert_authenticated" on public.analytics_events for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='analytics_events' and policyname='analytics_events_select_staff') then
    create policy "analytics_events_select_staff" on public.analytics_events for select to authenticated using (true);
  end if;
end $$;
