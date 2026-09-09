
-- event_registrations: staff read
DROP POLICY IF EXISTS event_reg_staff_read ON public.event_registrations;
CREATE POLICY event_reg_staff_read ON public.event_registrations FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()));

-- payments: staff read
DROP POLICY IF EXISTS payments_staff_read ON public.payments;
CREATE POLICY payments_staff_read ON public.payments FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));

-- researcher_publications: anon read for public researchers
DROP POLICY IF EXISTS pubs_read_anon ON public.researcher_publications;
CREATE POLICY pubs_read_anon ON public.researcher_publications FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.researchers r WHERE r.id = researcher_publications.researcher_id AND r.is_public = true));

-- ill_requests: patrons can submit their own
DROP POLICY IF EXISTS ill_insert_policy ON public.ill_requests;
CREATE POLICY ill_insert_policy ON public.ill_requests FOR INSERT TO authenticated
  WITH CHECK (patron_id IN (SELECT id FROM public.patrons WHERE user_id = auth.uid()));

-- course_reserves: staff-only writes
DROP POLICY IF EXISTS course_reserves_write ON public.course_reserves;
CREATE POLICY course_reserves_write ON public.course_reserves FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));

-- course_reserve_items: staff-only writes
DROP POLICY IF EXISTS cri_write ON public.course_reserve_items;
CREATE POLICY cri_write ON public.course_reserve_items FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
