
DROP VIEW IF EXISTS public.consortium_members_public;

CREATE OR REPLACE FUNCTION public.list_consortium_members_public()
RETURNS TABLE (id uuid, institution_name text, short_code text, status text, email_domain text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, institution_name, short_code, status, lower(split_part(email, '@', 2)) AS email_domain
  FROM public.consortium_members
  WHERE status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.list_consortium_members_public() TO anon, authenticated;
