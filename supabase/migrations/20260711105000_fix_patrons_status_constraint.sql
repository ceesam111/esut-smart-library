alter table public.patrons drop constraint if exists patrons_status_check;

alter table public.patrons add constraint patrons_status_check
  check (status = any (array['pending','active','suspended','expired','rejected']));
