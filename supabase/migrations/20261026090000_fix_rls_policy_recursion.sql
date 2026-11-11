-- Fix Postgres 42P17 "infinite recursion detected in policy for relation theses".
--
-- Policies on thesis_supervisors, thesis_workflow and thesis_reviews contain
-- EXISTS subqueries against public.theses, and the theses policies query
-- thesis_supervisors back (theses_supervisor_read -> ts_read -> public.theses).
-- Every authenticated SELECT on theses, thesis_workflow, thesis_supervisors and
-- thesis_reviews therefore fails with HTTP 500 (live-verified against production
-- 2026-10-26 with a real authenticated-role JWT; read-only probes; all four
-- tables have 0 rows, proving the recursion is plan-time and data-independent).
--
-- The submitter check moves into a SECURITY DEFINER helper that reads
-- public.theses without re-entering row level security. The helper's result is
-- identical to the inline EXISTS: any row with submitter_id = auth.uid() is
-- visible under theses_own_submitter, so bypassing RLS cannot widen access.
-- All other policy predicates are preserved verbatim.

CREATE OR REPLACE FUNCTION public.is_thesis_submitter(p_thesis_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.theses t
    WHERE t.id = p_thesis_id AND t.submitter_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_thesis_submitter(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_thesis_submitter(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_thesis_submitter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_thesis_submitter(uuid) TO service_role;

DROP POLICY IF EXISTS ts_read ON public.thesis_supervisors;
CREATE POLICY ts_read ON public.thesis_supervisors FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patrons p WHERE p.user_id = auth.uid() AND lower(p.email) = lower(thesis_supervisors.supervisor_email))
    OR public.is_thesis_submitter(thesis_id)
  );

DROP POLICY IF EXISTS ts_insert ON public.thesis_supervisors;
CREATE POLICY ts_insert ON public.thesis_supervisors FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()) OR public.is_thesis_submitter(thesis_id));

DROP POLICY IF EXISTS ts_update ON public.thesis_supervisors;
CREATE POLICY ts_update ON public.thesis_supervisors FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR public.is_thesis_submitter(thesis_id))
  WITH CHECK (public.is_library_staff(auth.uid()) OR public.is_thesis_submitter(thesis_id));

DROP POLICY IF EXISTS ts_delete ON public.thesis_supervisors;
CREATE POLICY ts_delete ON public.thesis_supervisors FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR public.is_thesis_submitter(thesis_id));

DROP POLICY IF EXISTS tw_read ON public.thesis_workflow;
CREATE POLICY tw_read ON public.thesis_workflow FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR acted_by = auth.uid()
    OR public.is_thesis_submitter(thesis_id)
  );

DROP POLICY IF EXISTS thesis_reviews_owner_read ON public.thesis_reviews;
CREATE POLICY thesis_reviews_owner_read ON public.thesis_reviews FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR public.is_thesis_submitter(thesis_id)
  );
