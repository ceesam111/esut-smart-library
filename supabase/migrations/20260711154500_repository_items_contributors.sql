alter table public.repository_items
  add column if not exists contributors jsonb not null default '[]'::jsonb;
