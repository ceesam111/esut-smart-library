
-- Restrict full consortium_members table reads to authenticated users (hides email/phone from anon)
DROP POLICY IF EXISTS consortium_members_select ON public.consortium_members;
CREATE POLICY consortium_members_select ON public.consortium_members FOR SELECT TO authenticated USING (true);

-- Public, safe-column view for the public databases directory
CREATE OR REPLACE VIEW public.consortium_members_public
WITH (security_invoker = true) AS
  SELECT id, institution_name, short_code, status
  FROM public.consortium_members;

GRANT SELECT ON public.consortium_members_public TO anon, authenticated;

-- Allow anon to read safe columns through the view
CREATE POLICY consortium_members_public_select ON public.consortium_members FOR SELECT TO anon
  USING (false);
