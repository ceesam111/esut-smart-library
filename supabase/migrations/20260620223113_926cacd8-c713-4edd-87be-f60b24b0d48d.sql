ALTER TABLE public.patrons DROP CONSTRAINT IF EXISTS patrons_status_check;
ALTER TABLE public.patrons ADD CONSTRAINT patrons_status_check
  CHECK (status = ANY (ARRAY['pending','active','suspended','expired','rejected']));