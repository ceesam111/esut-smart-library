-- ── Union Catalogue: branch origin ───────────────────────────────────────────
ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS branch_origin text;

-- ── Consortium members ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consortium_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_name text NOT NULL,
  short_code text,
  contact_person text,
  email text,
  phone text,
  website text,
  city text,
  country text DEFAULT 'Nigeria',
  status text NOT NULL DEFAULT 'active',
  is_founding_member boolean NOT NULL DEFAULT false,
  notes text,
  onboarded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.consortium_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consortium_members TO authenticated;
GRANT ALL ON public.consortium_members TO service_role;

ALTER TABLE public.consortium_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY consortium_members_select ON public.consortium_members
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY consortium_members_insert ON public.consortium_members
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY consortium_members_update ON public.consortium_members
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY consortium_members_delete ON public.consortium_members
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- ── Consortium databases ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consortium_databases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES public.consortium_members(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text,
  description text,
  access_url text,
  subjects text[],
  access_type text DEFAULT 'Consortium — Member Access',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.consortium_databases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consortium_databases TO authenticated;
GRANT ALL ON public.consortium_databases TO service_role;

ALTER TABLE public.consortium_databases ENABLE ROW LEVEL SECURITY;

CREATE POLICY consortium_databases_select ON public.consortium_databases
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY consortium_databases_insert ON public.consortium_databases
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY consortium_databases_update ON public.consortium_databases
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY consortium_databases_delete ON public.consortium_databases
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- ── Consortium access logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consortium_access_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id uuid REFERENCES public.consortium_databases(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.consortium_members(id) ON DELETE SET NULL,
  user_id uuid,
  user_name text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.consortium_access_logs TO authenticated;
GRANT ALL ON public.consortium_access_logs TO service_role;

ALTER TABLE public.consortium_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY consortium_logs_insert ON public.consortium_access_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY consortium_logs_select ON public.consortium_access_logs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
  );

-- ── updated_at triggers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_consortium_members_updated ON public.consortium_members;
CREATE TRIGGER trg_consortium_members_updated BEFORE UPDATE ON public.consortium_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_consortium_databases_updated ON public.consortium_databases;
CREATE TRIGGER trg_consortium_databases_updated BEFORE UPDATE ON public.consortium_databases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Seed AFUED as founding member ────────────────────────────────────────────
INSERT INTO public.consortium_members (institution_name, short_code, contact_person, email, city, country, status, is_founding_member, notes)
SELECT 'Alvan Ikoku Federal University of Education', 'AFUED', 'University Librarian', 'librarian@afued.edu.ng', 'Owerri', 'Nigeria', 'active', true, 'Founding member of the AFUED Library Consortium.'
WHERE NOT EXISTS (SELECT 1 FROM public.consortium_members WHERE short_code = 'AFUED');