
-- 1. suggestions: owner/staff only; protect anonymous (patron_id IS NULL) rows
DROP POLICY IF EXISTS suggestions_own ON public.suggestions;
CREATE POLICY suggestions_select ON public.suggestions FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR (patron_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.patrons p WHERE p.user_id = auth.uid() AND p.id = suggestions.patron_id)));
CREATE POLICY suggestions_insert ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (patron_id IS NULL OR EXISTS (SELECT 1 FROM public.patrons p WHERE p.user_id = auth.uid() AND p.id = suggestions.patron_id));
CREATE POLICY suggestions_update ON public.suggestions FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR (patron_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.patrons p WHERE p.user_id = auth.uid() AND p.id = suggestions.patron_id)))
  WITH CHECK (public.is_library_staff(auth.uid()) OR (patron_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.patrons p WHERE p.user_id = auth.uid() AND p.id = suggestions.patron_id)));
CREATE POLICY suggestions_delete ON public.suggestions FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR (patron_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.patrons p WHERE p.user_id = auth.uid() AND p.id = suggestions.patron_id)));

-- 2. blog_comments: authenticated see approved + own + staff
DROP POLICY IF EXISTS blog_comments_auth_select ON public.blog_comments;
CREATE POLICY blog_comments_auth_select ON public.blog_comments FOR SELECT TO authenticated
  USING (is_approved = true OR patron_id = auth.uid() OR public.is_library_staff(auth.uid()));

-- 3. procurement / finance reads -> staff / active librarian
DROP POLICY IF EXISTS budget_read ON public.acquisition_budgets;
CREATE POLICY budget_read ON public.acquisition_budgets FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
DROP POLICY IF EXISTS po_read ON public.purchase_orders;
CREATE POLICY po_read ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
DROP POLICY IF EXISTS poi_read ON public.purchase_order_items;
CREATE POLICY poi_read ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
DROP POLICY IF EXISTS inv_read ON public.supplier_invoices;
CREATE POLICY inv_read ON public.supplier_invoices FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));

-- 4. reserve_clicks: self or staff
DROP POLICY IF EXISTS rc_read ON public.reserve_clicks;
CREATE POLICY rc_read ON public.reserve_clicks FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR patron_id IN (SELECT id FROM public.patrons WHERE user_id = auth.uid()));

-- 5. thesis_reviews: use app role system
DROP POLICY IF EXISTS thesis_reviews_admin ON public.thesis_reviews;
CREATE POLICY thesis_reviews_staff ON public.thesis_reviews FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));

-- 6. resource_requests: use app role system instead of raw JWT claim
DROP POLICY IF EXISTS rr_admin_update ON public.resource_requests;
DROP POLICY IF EXISTS rr_admin_delete ON public.resource_requests;
DROP POLICY IF EXISTS rr_patron_select ON public.resource_requests;
CREATE POLICY rr_patron_select ON public.resource_requests FOR SELECT TO authenticated
  USING (patron_id IN (SELECT id FROM public.patrons WHERE user_id = auth.uid()) OR public.is_library_staff(auth.uid()));
CREATE POLICY rr_admin_update ON public.resource_requests FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY rr_admin_delete ON public.resource_requests FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()));
