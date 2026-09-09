-- Restrict SELECT on internal/operational/financial tables to library staff only

-- content_engine_config (administrative config)
DROP POLICY IF EXISTS select_engine_config ON public.content_engine_config;
CREATE POLICY select_engine_config ON public.content_engine_config
  FOR SELECT TO authenticated
  USING (is_library_staff(auth.uid()));

-- harvest_log (internal operational logs)
DROP POLICY IF EXISTS select_harvest_log ON public.harvest_log;
CREATE POLICY select_harvest_log ON public.harvest_log
  FOR SELECT TO authenticated
  USING (is_library_staff(auth.uid()));

-- serials_issues (internal serials operations)
DROP POLICY IF EXISTS issues_read ON public.serials_issues;
CREATE POLICY issues_read ON public.serials_issues
  FOR SELECT TO authenticated
  USING (is_library_staff(auth.uid()));

-- serials_subscriptions (procurement/finance data)
DROP POLICY IF EXISTS subs_read ON public.serials_subscriptions;
CREATE POLICY subs_read ON public.serials_subscriptions
  FOR SELECT TO authenticated
  USING (is_library_staff(auth.uid()));

-- Fix mutable search_path on gen_request_ref
CREATE OR REPLACE FUNCTION public.gen_request_ref()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'REQ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('resource_request_seq')::text, 4, '0');
$function$;