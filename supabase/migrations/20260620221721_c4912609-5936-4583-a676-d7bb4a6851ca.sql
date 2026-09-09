-- ============================================================
-- Role-based auth: enums, user_roles, patron profile extension,
-- RLS, library-number assignment, level-increment job
-- ============================================================

-- 1. Enums -----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'super_admin','librarian','faculty_librarian',
    'student','researcher_lecturer','admin_staff','guest'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.librarian_section AS ENUM (
    'Acquisitions','Cataloguing','Circulation','Reference',
    'Serials','Digital Services','Administration','Special Collections'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_roles table -----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  branch_code text,
  faculty_code text,
  librarian_section public.librarian_section,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security-definer role helpers ----------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

-- Can the given user (librarian / faculty_librarian) manage a patron in _branch?
CREATE OR REPLACE FUNCTION public.librarian_covers_branch(_user_id uuid, _branch text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('librarian','faculty_librarian')
      AND (branch_code IS NULL OR branch_code = _branch)
  );
$$;

-- 4. user_roles RLS -------------------------------------------
DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles;
CREATE POLICY user_roles_select_self ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS user_roles_superadmin_all ON public.user_roles;
CREATE POLICY user_roles_superadmin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. Extend patrons (profile of record) -----------------------
ALTER TABLE public.patrons
  ADD COLUMN IF NOT EXISTS surname text,
  ADD COLUMN IF NOT EXISTS other_names text,
  ADD COLUMN IF NOT EXISTS student_type text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS duration_years integer,
  ADD COLUMN IF NOT EXISTS current_level text,
  ADD COLUMN IF NOT EXISTS academic_rank text,
  ADD COLUMN IF NOT EXISTS research_interests text[],
  ADD COLUMN IF NOT EXISTS highest_qualification text,
  ADD COLUMN IF NOT EXISTS professional_qualification text,
  ADD COLUMN IF NOT EXISTS short_bio text,
  ADD COLUMN IF NOT EXISTS preferred_branch text,
  ADD COLUMN IF NOT EXISTS library_section text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS account_role text,
  ADD COLUMN IF NOT EXISTS library_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.patrons ALTER COLUMN status SET DEFAULT 'pending';

-- 6. Library-number assignment --------------------------------
CREATE SEQUENCE IF NOT EXISTS public.library_number_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_library_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (NEW.library_number IS NULL OR NEW.library_number = '') THEN
    NEW.library_number := 'AFUED-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.library_number_seq')::text, 5, '0');
    IF NEW.approved_at IS NULL THEN NEW.approved_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_library_number ON public.patrons;
CREATE TRIGGER trg_assign_library_number
  BEFORE INSERT OR UPDATE OF status ON public.patrons
  FOR EACH ROW EXECUTE FUNCTION public.assign_library_number();

-- 7. patrons RLS rewrite --------------------------------------
DROP POLICY IF EXISTS patrons_insert_policy ON public.patrons;
DROP POLICY IF EXISTS patrons_select_policy ON public.patrons;
DROP POLICY IF EXISTS patrons_update_policy ON public.patrons;

-- self can create own pending profile during registration
CREATE POLICY patrons_insert_self ON public.patrons
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- staff can create patrons in their scope
CREATE POLICY patrons_insert_staff ON public.patrons
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid())
              OR public.librarian_covers_branch(auth.uid(), preferred_branch));

CREATE POLICY patrons_select_self ON public.patrons
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id
         OR public.is_super_admin(auth.uid())
         OR public.librarian_covers_branch(auth.uid(), preferred_branch));

CREATE POLICY patrons_update_self ON public.patrons
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id
         OR public.is_super_admin(auth.uid())
         OR public.librarian_covers_branch(auth.uid(), preferred_branch))
  WITH CHECK (auth.uid() = user_id
         OR public.is_super_admin(auth.uid())
         OR public.librarian_covers_branch(auth.uid(), preferred_branch));

CREATE POLICY patrons_delete_admin ON public.patrons
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 8. One-time super-admin bootstrap ---------------------------
-- Safe & idempotent: only works while NO super_admin exists yet,
-- so it cannot be abused for privilege escalation afterwards.
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RETURN 'A super_admin already exists; bootstrap disabled.';
  END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN 'No account found for ' || _email || '. Have them sign up first.';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN 'Granted super_admin to ' || _email;
END;
$$;

-- 9. Annual student level increment ---------------------------
CREATE OR REPLACE FUNCTION public.increment_student_levels()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.patrons SET current_level = CASE current_level
      WHEN '100L' THEN '200L'
      WHEN '200L' THEN '300L'
      WHEN '300L' THEN '400L'
      WHEN '400L' THEN '500L'
      ELSE current_level
    END
  WHERE current_level IN ('100L','200L','300L','400L')
    AND COALESCE(student_type,'') NOT IN ('PostDoc')
    AND status = 'active';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- updated_at trigger for user_roles
DROP TRIGGER IF EXISTS trg_user_roles_updated ON public.user_roles;
CREATE TRIGGER trg_user_roles_updated
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();