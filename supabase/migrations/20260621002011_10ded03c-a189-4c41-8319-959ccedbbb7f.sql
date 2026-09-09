
-- Helper: library staff check
CREATE OR REPLACE FUNCTION public.is_library_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','librarian','faculty_librarian')
  );
$$;

-- 1. academic_calendar: staff-only writes
DROP POLICY IF EXISTS insert_academic_calendar ON public.academic_calendar;
DROP POLICY IF EXISTS update_academic_calendar ON public.academic_calendar;
DROP POLICY IF EXISTS delete_academic_calendar ON public.academic_calendar;
CREATE POLICY insert_academic_calendar ON public.academic_calendar FOR INSERT TO authenticated WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY update_academic_calendar ON public.academic_calendar FOR UPDATE TO authenticated USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY delete_academic_calendar ON public.academic_calendar FOR DELETE TO authenticated USING (public.is_library_staff(auth.uid()));

-- 2. admin_access_log: staff-only read
DROP POLICY IF EXISTS librarians_read_access_log ON public.admin_access_log;
CREATE POLICY librarians_read_access_log ON public.admin_access_log FOR SELECT TO authenticated USING (public.is_library_staff(auth.uid()));

-- 3. blog_comments: owner or staff edit/delete
DROP POLICY IF EXISTS blog_comments_delete ON public.blog_comments;
DROP POLICY IF EXISTS blog_comments_update ON public.blog_comments;
CREATE POLICY blog_comments_delete ON public.blog_comments FOR DELETE TO authenticated USING (patron_id = auth.uid() OR public.is_library_staff(auth.uid()));
CREATE POLICY blog_comments_update ON public.blog_comments FOR UPDATE TO authenticated USING (patron_id = auth.uid() OR public.is_library_staff(auth.uid())) WITH CHECK (patron_id = auth.uid() OR public.is_library_staff(auth.uid()));

-- 4. cms_menu: staff-only writes
DROP POLICY IF EXISTS cms_menu_insert ON public.cms_menu;
DROP POLICY IF EXISTS cms_menu_update ON public.cms_menu;
DROP POLICY IF EXISTS cms_menu_delete ON public.cms_menu;
CREATE POLICY cms_menu_insert ON public.cms_menu FOR INSERT TO authenticated WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY cms_menu_update ON public.cms_menu FOR UPDATE TO authenticated USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY cms_menu_delete ON public.cms_menu FOR DELETE TO authenticated USING (public.is_library_staff(auth.uid()));

-- 5. content_engine_config: staff-only writes
DROP POLICY IF EXISTS insert_engine_config ON public.content_engine_config;
DROP POLICY IF EXISTS update_engine_config ON public.content_engine_config;
DROP POLICY IF EXISTS delete_engine_config ON public.content_engine_config;
CREATE POLICY insert_engine_config ON public.content_engine_config FOR INSERT TO authenticated WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY update_engine_config ON public.content_engine_config FOR UPDATE TO authenticated USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY delete_engine_config ON public.content_engine_config FOR DELETE TO authenticated USING (public.is_library_staff(auth.uid()));

-- 6. course_reading_list_items: owning lecturer or staff
DROP POLICY IF EXISTS crli_write ON public.course_reading_list_items;
DROP POLICY IF EXISTS crli_mod ON public.course_reading_list_items;
DROP POLICY IF EXISTS crli_del ON public.course_reading_list_items;
CREATE POLICY crli_write ON public.course_reading_list_items FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.course_reading_lists l WHERE l.id = list_id AND l.lecturer_id = auth.uid()));
CREATE POLICY crli_mod ON public.course_reading_list_items FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.course_reading_lists l WHERE l.id = list_id AND l.lecturer_id = auth.uid()))
  WITH CHECK (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.course_reading_lists l WHERE l.id = list_id AND l.lecturer_id = auth.uid()));
CREATE POLICY crli_del ON public.course_reading_list_items FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.course_reading_lists l WHERE l.id = list_id AND l.lecturer_id = auth.uid()));

-- 7. database_access_requests: staff-only read
DROP POLICY IF EXISTS db_req_auth_select ON public.database_access_requests;
CREATE POLICY db_req_auth_select ON public.database_access_requests FOR SELECT TO authenticated USING (public.is_library_staff(auth.uid()));

-- 8. item_versions: item submitter or staff for writes (reads unchanged)
DROP POLICY IF EXISTS versions_insert ON public.item_versions;
DROP POLICY IF EXISTS versions_update ON public.item_versions;
DROP POLICY IF EXISTS versions_delete ON public.item_versions;
CREATE POLICY versions_insert ON public.item_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.repository_items r WHERE r.id = item_id AND r.submitter_id = auth.uid()));
CREATE POLICY versions_update ON public.item_versions FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.repository_items r WHERE r.id = item_id AND r.submitter_id = auth.uid()))
  WITH CHECK (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.repository_items r WHERE r.id = item_id AND r.submitter_id = auth.uid()));
CREATE POLICY versions_delete ON public.item_versions FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.repository_items r WHERE r.id = item_id AND r.submitter_id = auth.uid()));

-- 9. library_shelves: staff-only writes
DROP POLICY IF EXISTS shelves_insert_auth ON public.library_shelves;
DROP POLICY IF EXISTS shelves_update_auth ON public.library_shelves;
DROP POLICY IF EXISTS shelves_delete_auth ON public.library_shelves;
CREATE POLICY shelves_insert_auth ON public.library_shelves FOR INSERT TO authenticated WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY shelves_update_auth ON public.library_shelves FOR UPDATE TO authenticated USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY shelves_delete_auth ON public.library_shelves FOR DELETE TO authenticated USING (public.is_library_staff(auth.uid()));

-- 10. migration_logs: staff-only access
DROP POLICY IF EXISTS logs_read ON public.migration_logs;
DROP POLICY IF EXISTS logs_insert ON public.migration_logs;
DROP POLICY IF EXISTS logs_update ON public.migration_logs;
DROP POLICY IF EXISTS logs_delete ON public.migration_logs;
CREATE POLICY logs_read ON public.migration_logs FOR SELECT TO authenticated USING (public.is_library_staff(auth.uid()));
CREATE POLICY logs_insert ON public.migration_logs FOR INSERT TO authenticated WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY logs_update ON public.migration_logs FOR UPDATE TO authenticated USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY logs_delete ON public.migration_logs FOR DELETE TO authenticated USING (public.is_library_staff(auth.uid()));

-- 11. purchase_recommendations: requester or active librarian read
DROP POLICY IF EXISTS recs_read ON public.purchase_recommendations;
CREATE POLICY recs_read ON public.purchase_recommendations FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));

-- 12. report_snapshots: staff-only
DROP POLICY IF EXISTS librarians_manage_snapshots ON public.report_snapshots;
CREATE POLICY librarians_manage_snapshots ON public.report_snapshots FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));

-- 13. serials_routing: active librarian read
DROP POLICY IF EXISTS routing_read ON public.serials_routing;
CREATE POLICY routing_read ON public.serials_routing FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));

-- 14. thesis_supervisors: owner/supervisor/staff read; owner/staff writes
DROP POLICY IF EXISTS ts_read ON public.thesis_supervisors;
DROP POLICY IF EXISTS ts_insert ON public.thesis_supervisors;
DROP POLICY IF EXISTS ts_update ON public.thesis_supervisors;
DROP POLICY IF EXISTS ts_delete ON public.thesis_supervisors;
CREATE POLICY ts_read ON public.thesis_supervisors FOR SELECT TO authenticated
  USING (
    public.is_library_staff(auth.uid())
    OR supervisor_email = (auth.jwt() ->> 'email')
    OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid())
  );
CREATE POLICY ts_insert ON public.thesis_supervisors FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid()));
CREATE POLICY ts_update ON public.thesis_supervisors FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid()))
  WITH CHECK (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid()));
CREATE POLICY ts_delete ON public.thesis_supervisors FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.theses t WHERE t.id = thesis_id AND t.submitter_id = auth.uid()));

-- 15. thesis_workflow: staff or the acting user
DROP POLICY IF EXISTS tw_insert ON public.thesis_workflow;
CREATE POLICY tw_insert ON public.thesis_workflow FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()) OR acted_by = auth.uid());
