create table if not exists email_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('resend', 'emailbump', 'smtp')),
  label text not null,
  from_email text not null,
  from_name text,
  is_enabled boolean not null default false,
  priority integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table email_provider_configs enable row level security;

revoke all on email_provider_configs from anon, authenticated;
