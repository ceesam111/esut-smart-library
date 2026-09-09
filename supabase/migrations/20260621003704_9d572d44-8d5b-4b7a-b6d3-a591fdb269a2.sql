
-- reserve_clicks: enforce ownership on insert
DROP POLICY IF EXISTS rc_insert ON public.reserve_clicks;
CREATE POLICY rc_insert ON public.reserve_clicks FOR INSERT TO authenticated
  WITH CHECK (patron_id IN (SELECT id FROM public.patrons WHERE user_id = auth.uid()));

-- blog_comments: anonymous inserts must not attach a patron_id
DROP POLICY IF EXISTS blog_comments_insert_anon ON public.blog_comments;
CREATE POLICY blog_comments_insert_anon ON public.blog_comments FOR INSERT TO anon
  WITH CHECK (patron_id IS NULL);

-- thesis_supervisors: robust supervisor self-access via patrons email
DROP POLICY IF EXISTS ts_read ON public.thesis_supervisors;
CREATE POLICY ts_read ON public.thesis_supervisors FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patrons p WHERE p.user_id = auth.uid() AND lower(p.email) = lower(thesis_supervisors.supervisor_email))
    OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid())
  );

-- librarians: allow staff/super_admin to view records
DROP POLICY IF EXISTS librarians_select ON public.librarians;
CREATE POLICY librarians_select ON public.librarians FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_library_staff(auth.uid())
  );
