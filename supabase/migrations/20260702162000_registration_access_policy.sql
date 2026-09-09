alter table if exists public.patrons
  add column if not exists email_verified_at timestamptz,
  add column if not exists main_library_access_at timestamptz,
  add column if not exists branch_approved_at timestamptz,
  add column if not exists branch_approved_by uuid,
  add column if not exists registration_policy text;

create table if not exists public.registration_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  patron_id uuid references public.patrons(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_registration_verification_tokens_hash on public.registration_verification_tokens(token_hash);
create index if not exists idx_registration_verification_tokens_user on public.registration_verification_tokens(user_id);

alter table public.registration_verification_tokens enable row level security;

drop policy if exists registration_verification_tokens_service_only on public.registration_verification_tokens;
create policy registration_verification_tokens_service_only on public.registration_verification_tokens
  for all to service_role using (true) with check (true);

insert into public.app_settings (key, value, description)
values (
  'registration_access_policy',
  '{"mode":"email_verification_with_branch_approval"}'::jsonb,
  'Controls whether new patron registrations require email verification, branch approval, or direct access.'
)
on conflict (key) do nothing;
