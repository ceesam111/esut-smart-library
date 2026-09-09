
-- admin_access_log: staff-only insert
DROP POLICY IF EXISTS librarians_insert_access_log ON public.admin_access_log;
CREATE POLICY librarians_insert_access_log ON public.admin_access_log FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()));

-- librarians: super_admin management
DROP POLICY IF EXISTS librarians_admin_insert ON public.librarians;
DROP POLICY IF EXISTS librarians_admin_update ON public.librarians;
DROP POLICY IF EXISTS librarians_admin_delete ON public.librarians;
CREATE POLICY librarians_admin_insert ON public.librarians FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY librarians_admin_update ON public.librarians FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY librarians_admin_delete ON public.librarians FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- thesis_workflow: restrict read to owner / acting user / staff
DROP POLICY IF EXISTS tw_read ON public.thesis_workflow;
CREATE POLICY tw_read ON public.thesis_workflow FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR acted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid())
  );

-- thesis_reviews: allow thesis owner to read their own reviews
CREATE POLICY thesis_reviews_owner_read ON public.thesis_reviews FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid())
  );
