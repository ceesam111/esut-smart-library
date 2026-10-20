-- Rollback for 20261011130000_rls_escalation_fixes.sql
-- Restores the previous policies verbatim, as last set by 20260620202651,
-- 20260620202944 and 20260621002011. Review before running: this re-opens the
-- browser-side self-publish and audit-forgery paths that the up-migration closed.

DROP POLICY IF EXISTS "repo_items_update_admin" ON repository_items;
DROP POLICY IF EXISTS "repo_items_update_own" ON repository_items;
CREATE POLICY "repo_items_update_own" ON repository_items FOR UPDATE TO authenticated
  USING (auth.uid() = submitter_id AND status IN ('submitted', 'draft'))
  WITH CHECK (auth.uid() = submitter_id);

DROP POLICY IF EXISTS "repo_items_insert" ON repository_items;
CREATE POLICY "repo_items_insert" ON repository_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitter_id);

DROP POLICY IF EXISTS "theses_update_admin" ON theses;
DROP POLICY IF EXISTS "theses_insert_own" ON theses;
DROP POLICY IF EXISTS "theses_update_own" ON theses;
DROP POLICY IF EXISTS "theses_delete_own" ON theses;
CREATE POLICY "theses_own" ON theses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM patrons WHERE patrons.user_id = auth.uid() AND patrons.id = theses.patron_id)
);
CREATE POLICY "theses_update_submitter" ON theses FOR UPDATE TO authenticated
  USING (auth.uid() = submitter_id)
  WITH CHECK (auth.uid() = submitter_id);

DROP POLICY IF EXISTS "tw_insert" ON thesis_workflow;
CREATE POLICY "tw_insert" ON thesis_workflow FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff(auth.uid()) OR acted_by = auth.uid());

DROP POLICY IF EXISTS "versions_read_anon" ON item_versions;
CREATE POLICY "versions_read_anon" ON item_versions FOR SELECT TO anon USING (true);
