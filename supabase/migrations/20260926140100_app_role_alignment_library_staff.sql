-- Catalog administrators are library staff: they need the same Postgres RLS
-- access as librarians (reservations, circulation, academic calendar, etc.)
-- because the admin pages query those tables directly from the browser.
--
-- Runs after 20260926140000_app_role_alignment_enum.sql so the
-- 'catalog_admin' enum literal is already valid.

CREATE OR REPLACE FUNCTION public.is_library_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','librarian','faculty_librarian','catalog_admin')
  );
$$;

-- Defence in depth: only super administrators may create admin roles.
-- Mirrors ADMIN_GRANT_ONLY_ROLES in src/server/auth/permissions.ts, which is
-- enforced in the UI but runs in the browser and cannot be trusted on its own.
DROP POLICY IF EXISTS user_roles_librarian_manage_non_super ON public.user_roles;
CREATE POLICY user_roles_librarian_manage_non_super ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'librarian')
    AND role NOT IN ('super_admin','catalog_admin','ir_admin','dept_ir_officer')
  );

