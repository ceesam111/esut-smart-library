-- ============================================================
-- FIX 1: Restrict team_members email to library staff only
-- ============================================================

-- Public read function: returns published team members, but email is only
-- included for library staff (others receive NULL email).
CREATE OR REPLACE FUNCTION public.list_team_members_public()
RETURNS TABLE (
  id uuid,
  name text,
  title text,
  qual text,
  bio text,
  email text,
  initials text,
  photo_url text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.title,
    t.qual,
    t.bio,
    CASE WHEN public.is_library_staff(auth.uid()) THEN t.email ELSE NULL END AS email,
    t.initials,
    t.photo_url,
    t.sort_order
  FROM public.team_members t
  WHERE t.is_published = true
  ORDER BY t.sort_order ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_team_members_public() TO anon, authenticated;

-- Tighten the base table so email (and unpublished rows) are no longer
-- directly readable by the public. Only library staff can SELECT directly.
DROP POLICY IF EXISTS "Anyone can view published team members" ON public.team_members;

CREATE POLICY "Library staff can view team members"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (public.is_library_staff(auth.uid()));

-- ============================================================
-- FIX 2: Require an explicit (non-null) branch match for librarians
-- ============================================================
CREATE OR REPLACE FUNCTION public.librarian_covers_branch(_user_id uuid, _branch text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('librarian','faculty_librarian')
      AND branch_code IS NOT NULL
      AND branch_code = _branch
  );
$$;