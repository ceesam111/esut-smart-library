
-- database_access_requests: staff-only edit/delete
DROP POLICY IF EXISTS db_req_update ON public.database_access_requests;
DROP POLICY IF EXISTS db_req_delete ON public.database_access_requests;
CREATE POLICY db_req_update ON public.database_access_requests FOR UPDATE TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY db_req_delete ON public.database_access_requests FOR DELETE TO authenticated
  USING (public.is_library_staff(auth.uid()));

-- acquisition_suppliers: staff / active-librarian read only
DROP POLICY IF EXISTS suppliers_read ON public.acquisition_suppliers;
CREATE POLICY suppliers_read ON public.acquisition_suppliers FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));

-- harvest_log: staff-only writes
DROP POLICY IF EXISTS insert_harvest_log ON public.harvest_log;
DROP POLICY IF EXISTS update_harvest_log ON public.harvest_log;
DROP POLICY IF EXISTS delete_harvest_log ON public.harvest_log;
CREATE POLICY insert_harvest_log ON public.harvest_log FOR INSERT TO authenticated WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY update_harvest_log ON public.harvest_log FOR UPDATE TO authenticated USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY delete_harvest_log ON public.harvest_log FOR DELETE TO authenticated USING (public.is_library_staff(auth.uid()));
