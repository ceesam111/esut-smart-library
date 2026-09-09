alter table public.patrons
  add column if not exists profile_photo_url text;
