-- Rollback for 20261026090000_fix_rls_policy_recursion.
-- Restores the pre-fix policy definitions verbatim (20260621002011 /
-- 20260621003543 / 20260621003704 final state). This re-introduces the
-- 42P17 recursion defect: authenticated SELECTs on theses,
-- thesis_workflow, thesis_supervisors and thesis_reviews will fail
-- again with HTTP 500. Roll back only together with an approved plan.

DROP POLICY IF EXISTS ts_read ON public.thesis_supervisors;
CREATE POLICY ts_read ON public.thesis_supervisors FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patrons p WHERE p.user_id = auth.uid() AND lower(p.email) = lower(thesis_supervisors.supervisor_email))
    OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid())
  );

DROP POLICY IF EXISTS ts_insert ON public.thesis_supervisors;
CREATE POLICY ts_insert ON public.thesis_supervisors FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid()));

DROP POLICY IF EXISTS ts_update ON public.thesis_supervisors;
CREATE POLICY ts_update ON public.thesis_supervisors FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid()))
  WITH CHECK (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid()));

DROP POLICY IF EXISTS ts_delete ON public.thesis_supervisors;
CREATE POLICY ts_delete ON public.thesis_supervisors FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid()));

DROP POLICY IF EXISTS tw_read ON public.thesis_workflow;
CREATE POLICY tw_read ON public.thesis_workflow FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR acted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid())
  );

DROP POLICY IF EXISTS thesis_reviews_owner_read ON public.thesis_reviews;
CREATE POLICY thesis_reviews_owner_read ON public.thesis_reviews FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid())
  );

DROP FUNCTION IF EXISTS public.is_thesis_submitter(uuid);
