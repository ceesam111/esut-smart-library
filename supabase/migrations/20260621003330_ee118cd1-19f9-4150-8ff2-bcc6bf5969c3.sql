
-- ===== Replace broken JWT-role checks with real role system =====

-- app_settings
DROP POLICY IF EXISTS settings_admin ON public.app_settings;
CREATE POLICY settings_admin ON public.app_settings FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));

-- audit_logs
DROP POLICY IF EXISTS audit_admin ON public.audit_logs;
CREATE POLICY audit_admin ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()));

-- migration_history
DROP POLICY IF EXISTS migration_admin ON public.migration_history;
CREATE POLICY migration_admin ON public.migration_history FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));

-- newsletter_issues
DROP POLICY IF EXISTS newsletter_admin ON public.newsletter_issues;
CREATE POLICY newsletter_admin ON public.newsletter_issues FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));

-- newsletter_subscribers: staff manage + public subscribe (insert)
DROP POLICY IF EXISTS subscribers_admin ON public.newsletter_subscribers;
CREATE POLICY subscribers_admin ON public.newsletter_subscribers FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));
CREATE POLICY subscribers_public_insert ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- webometrics_actions
DROP POLICY IF EXISTS webo_actions_write ON public.webometrics_actions;
CREATE POLICY webo_actions_write ON public.webometrics_actions FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));

-- webometrics_ranks
DROP POLICY IF EXISTS webo_ranks_write ON public.webometrics_ranks;
CREATE POLICY webo_ranks_write ON public.webometrics_ranks FOR ALL TO authenticated
  USING (public.is_library_staff(auth.uid())) WITH CHECK (public.is_library_staff(auth.uid()));

-- blog_posts: published OR staff
DROP POLICY IF EXISTS blog_read_published ON public.blog_posts;
CREATE POLICY blog_read_published ON public.blog_posts FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_library_staff(auth.uid()));

-- cms_pages: published OR staff
DROP POLICY IF EXISTS cms_read ON public.cms_pages;
CREATE POLICY cms_read ON public.cms_pages FOR SELECT TO authenticated
  USING (is_published = true OR public.is_library_staff(auth.uid()));

-- repository_items: published OR staff (authenticated)
DROP POLICY IF EXISTS repo_items_read ON public.repository_items;
CREATE POLICY repo_items_read ON public.repository_items FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_library_staff(auth.uid()) OR auth.uid() = submitter_id);

-- researchers: public OR staff
DROP POLICY IF EXISTS researchers_read ON public.researchers;
CREATE POLICY researchers_read ON public.researchers FOR SELECT TO authenticated
  USING (is_public = true OR public.is_library_staff(auth.uid()));

-- ===== Public (anon) read for public-facing content =====
DROP POLICY IF EXISTS databases_read_anon ON public.databases;
CREATE POLICY databases_read_anon ON public.databases FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS events_read_anon ON public.events;
CREATE POLICY events_read_anon ON public.events FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS announcements_read_anon ON public.announcements;
CREATE POLICY announcements_read_anon ON public.announcements FOR SELECT TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS banners_read_anon ON public.cms_banners;
CREATE POLICY banners_read_anon ON public.cms_banners FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS cms_read_anon ON public.cms_pages;
CREATE POLICY cms_read_anon ON public.cms_pages FOR SELECT TO anon USING (is_published = true);

DROP POLICY IF EXISTS blog_read_anon ON public.blog_posts;
CREATE POLICY blog_read_anon ON public.blog_posts FOR SELECT TO anon USING (status = 'published');

DROP POLICY IF EXISTS researchers_read_anon ON public.researchers;
CREATE POLICY researchers_read_anon ON public.researchers FOR SELECT TO anon USING (is_public = true);

-- ===== consortium_members: staff-only contact details + safe public view =====
DROP POLICY IF EXISTS consortium_members_public_select ON public.consortium_members;
DROP POLICY IF EXISTS consortium_members_select ON public.consortium_members;
CREATE POLICY consortium_members_select ON public.consortium_members FOR SELECT TO authenticated
  USING (public.is_library_staff(auth.uid()));

DROP VIEW IF EXISTS public.consortium_members_public;
CREATE VIEW public.consortium_members_public AS
  SELECT id, institution_name, short_code, status, lower(split_part(email, '@', 2)) AS email_domain
  FROM public.consortium_members;
GRANT SELECT ON public.consortium_members_public TO anon, authenticated;
