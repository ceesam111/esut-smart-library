-- Security hardening: close submission escalation and audit-trail forgery gaps.
-- Discovered during T03 review. The workflow engine (service-role) remains the only
-- server path to publish/approve; these policies stop browser-side self-publishing.
--
-- Staff moderation is checked with public.has_any_role (SECURITY DEFINER over
-- user_roles/patrons) because the Supabase JWT `role` claim is 'authenticated' for
-- every browser session and can never carry an application role.

-- 1) repository_items: a submitter may edit their own item only while it is still
--    'submitted' and may not change its status (the previous WITH CHECK allowed
--    flipping a row to 'published' or 'approved').
DROP POLICY IF EXISTS "repo_items_update_own" ON repository_items;
CREATE POLICY "repo_items_update_own" ON repository_items FOR UPDATE TO authenticated
  USING (auth.uid() = submitter_id AND status = 'submitted')
  WITH CHECK (auth.uid() = submitter_id AND status = 'submitted');

-- 1b) repository_items: submitters insert only as 'submitted'; moderators (library
--     admins plus IR stewardship roles) may insert any status for bulk imports.
DROP POLICY IF EXISTS "repo_items_insert" ON repository_items;
CREATE POLICY "repo_items_insert" ON repository_items FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = submitter_id AND status = 'submitted')
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','librarian','faculty_librarian','catalog_admin','admin','ir_admin','dept_ir_officer'])
  );

-- 1c) repository_items: moderators may update any item (review, publish, reject).
DROP POLICY IF EXISTS "repo_items_update_admin" ON repository_items;
CREATE POLICY "repo_items_update_admin" ON repository_items FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','librarian','faculty_librarian','catalog_admin','admin','ir_admin','dept_ir_officer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','librarian','faculty_librarian','catalog_admin','admin','ir_admin','dept_ir_officer']));

-- 2) theses: replace the broad patron-only "for all" policy with scoped policies.
--    The owner predicate keeps the original patron link and adds submitter_id so
--    legacy rows without a patron link stay manageable by their submitter.
DROP POLICY IF EXISTS "theses_own" ON theses;
DROP POLICY IF EXISTS "theses_update_submitter" ON theses;

CREATE POLICY "theses_insert_own" ON theses FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = submitter_id OR EXISTS (SELECT 1 FROM patrons p WHERE p.user_id = auth.uid() AND p.id = theses.patron_id))
    AND status NOT IN ('published', 'approved')
  );

CREATE POLICY "theses_update_own" ON theses FOR UPDATE TO authenticated
  USING (auth.uid() = submitter_id OR EXISTS (SELECT 1 FROM patrons p WHERE p.user_id = auth.uid() AND p.id = theses.patron_id))
  WITH CHECK (
    (auth.uid() = submitter_id OR EXISTS (SELECT 1 FROM patrons p WHERE p.user_id = auth.uid() AND p.id = theses.patron_id))
    AND status NOT IN ('published', 'approved')
  );

CREATE POLICY "theses_delete_own" ON theses FOR DELETE TO authenticated
  USING (
    (auth.uid() = submitter_id OR EXISTS (SELECT 1 FROM patrons p WHERE p.user_id = auth.uid() AND p.id = theses.patron_id))
    AND status NOT IN ('published', 'approved')
  );

-- 2b) theses: moderators may update any thesis, including publishing it from the
--     admin review screen (previously no staff UPDATE policy matched, so browser
--     publish attempts silently updated zero rows).
DROP POLICY IF EXISTS "theses_update_admin" ON theses;
CREATE POLICY "theses_update_admin" ON theses FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','librarian','faculty_librarian','catalog_admin','admin','ir_admin','dept_ir_officer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','librarian','faculty_librarian','catalog_admin','admin','ir_admin','dept_ir_officer']));

-- 3) thesis_workflow: audit rows may only be recorded by the user who performed
--    the action. The admin and supervisor screens set acted_by to the signed-in
--    user; service-role writers bypass RLS unchanged.
DROP POLICY IF EXISTS "tw_insert" ON thesis_workflow;
CREATE POLICY "tw_insert" ON thesis_workflow FOR INSERT TO authenticated
  WITH CHECK (acted_by = auth.uid());

-- 4) item_versions: anonymous readers only see versions of published, global items.
--    This keeps the public Versions tab working without exposing file links for
--    unpublished or embargoed items.
DROP POLICY IF EXISTS "versions_read_anon" ON item_versions;
CREATE POLICY "versions_read_anon" ON item_versions FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM repository_items i
      WHERE i.id = item_versions.item_id
        AND i.status = 'published'
        AND i.visibility = 'global'
    )
  );
