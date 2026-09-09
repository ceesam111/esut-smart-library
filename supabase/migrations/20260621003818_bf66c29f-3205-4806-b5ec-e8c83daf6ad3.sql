
-- purchase_recommendations: anon insert must not spoof a user identity
DROP POLICY IF EXISTS recs_insert_public ON public.purchase_recommendations;
CREATE POLICY recs_insert_public ON public.purchase_recommendations FOR INSERT TO anon
  WITH CHECK (requested_by IS NULL);

-- loan_fines: staff can read all
DROP POLICY IF EXISTS fines_read_staff ON public.loan_fines;
CREATE POLICY fines_read_staff ON public.loan_fines FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));

-- reservations: patrons can create their own
DROP POLICY IF EXISTS reservations_insert_policy ON public.reservations;
CREATE POLICY reservations_insert_policy ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (patron_id IN (SELECT id FROM public.patrons WHERE user_id = auth.uid()));
