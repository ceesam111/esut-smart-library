CREATE TABLE IF NOT EXISTS reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  patron_name text,
  item_type   text NOT NULL CHECK (item_type IN ('catalogue', 'repository')),
  item_id     uuid NOT NULL,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update" ON reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_delete" ON reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_item ON reviews (item_type, item_id);

CREATE TABLE IF NOT EXISTS feed_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  patron_name  text,
  faculty_code text,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  likes_count  int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_events_select" ON feed_events FOR SELECT USING (true);
CREATE POLICY "feed_events_insert" ON feed_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feed_events_update" ON feed_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "feed_events_delete" ON feed_events FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_feed_events_created ON feed_events (created_at DESC);

CREATE TABLE IF NOT EXISTS feed_event_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE feed_event_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON feed_event_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON feed_event_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_update" ON feed_event_likes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON feed_event_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS discussions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type   text NOT NULL CHECK (item_type IN ('catalogue', 'repository')),
  item_id     uuid NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  patron_name text,
  parent_id   uuid REFERENCES discussions(id) ON DELETE CASCADE,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discussions_select" ON discussions FOR SELECT USING (true);
CREATE POLICY "discussions_insert" ON discussions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "discussions_update" ON discussions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "discussions_delete" ON discussions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_item ON discussions (item_type, item_id);

CREATE TABLE IF NOT EXISTS book_clubs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  faculty_code text,
  created_by   uuid REFERENCES auth.users(id),
  creator_name text,
  is_public    boolean NOT NULL DEFAULT true,
  cover_image  text,
  member_count int NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE book_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clubs_select" ON book_clubs FOR SELECT USING (true);
CREATE POLICY "clubs_insert" ON book_clubs FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "clubs_update" ON book_clubs FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "clubs_delete" ON book_clubs FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS club_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patron_name text,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select" ON club_members FOR SELECT USING (true);
CREATE POLICY "members_insert" ON club_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_update" ON club_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "members_delete" ON club_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS club_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  patron_name text,
  parent_id   uuid REFERENCES club_posts(id) ON DELETE CASCADE,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE club_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_posts_select" ON club_posts FOR SELECT USING (true);
CREATE POLICY "club_posts_insert" ON club_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "club_posts_update" ON club_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "club_posts_delete" ON club_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_club_posts_club ON club_posts (club_id, created_at DESC);

CREATE TABLE IF NOT EXISTS annotations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_item_id     uuid NOT NULL,
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  patron_name      text,
  faculty_code     text,
  highlighted_text text NOT NULL,
  comment          text,
  page_number      int,
  is_private       boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annotations_select" ON annotations FOR SELECT TO authenticated USING (NOT is_private OR auth.uid() = user_id);
CREATE POLICY "annotations_insert" ON annotations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "annotations_update" ON annotations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "annotations_delete" ON annotations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_item ON annotations (repo_item_id);

ALTER TABLE reading_list_items
  ADD COLUMN IF NOT EXISTS item_type   text DEFAULT 'catalogue',
  ADD COLUMN IF NOT EXISTS item_title  text,
  ADD COLUMN IF NOT EXISTS item_authors text;

CREATE SEQUENCE IF NOT EXISTS resource_request_seq START 1;

CREATE OR REPLACE FUNCTION gen_request_ref()
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'REQ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('resource_request_seq')::text, 4, '0');
$$;

CREATE TABLE IF NOT EXISTS resource_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patron_id           uuid        NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  patron_name         text,
  patron_email        text,
  patron_faculty      text,
  patron_department   text,
  reference_no        text        UNIQUE NOT NULL DEFAULT gen_request_ref(),
  item_title          text,
  request_text        text        NOT NULL,
  reason              text        NOT NULL,
  course              text,
  needed_by_date      date,
  preferred_format    text        NOT NULL DEFAULT 'Either',
  status              text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','being_sourced','ready_for_collection','fulfilled','cannot_fulfil')),
  librarian_note      text,
  collection_location text,
  collect_by_date     date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE resource_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr_patron_select" ON resource_requests FOR SELECT TO authenticated
  USING (
    patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'role' IN ('admin', 'librarian')
  );
CREATE POLICY "rr_patron_insert" ON resource_requests FOR INSERT TO authenticated
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));
CREATE POLICY "rr_admin_update" ON resource_requests FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'librarian'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'librarian'));
CREATE POLICY "rr_admin_delete" ON resource_requests FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'librarian'));
CREATE INDEX IF NOT EXISTS idx_rr_patron ON resource_requests (patron_id);
CREATE INDEX IF NOT EXISTS idx_rr_status  ON resource_requests (status);
CREATE INDEX IF NOT EXISTS idx_rr_created ON resource_requests (created_at DESC);

ALTER TABLE repository_items
  ADD COLUMN IF NOT EXISTS item_type TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS supervisor TEXT,
  ADD COLUMN IF NOT EXISTS submitter_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS zenodo_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repository_items' AND policyname='repo_items_read_anon') THEN
    CREATE POLICY "repo_items_read_anon" ON repository_items FOR SELECT TO anon USING (status = 'published' AND visibility = 'global');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repository_items' AND policyname='repo_items_insert') THEN
    CREATE POLICY "repo_items_insert" ON repository_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitter_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repository_items' AND policyname='repo_items_update_own') THEN
    CREATE POLICY "repo_items_update_own" ON repository_items FOR UPDATE TO authenticated
      USING (auth.uid() = submitter_id AND status IN ('submitted', 'draft'))
      WITH CHECK (auth.uid() = submitter_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repository_communities' AND policyname='communities_read_anon') THEN
    CREATE POLICY "communities_read_anon" ON repository_communities FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='repository_collections' AND policyname='collections_read_anon') THEN
    CREATE POLICY "collections_read_anon" ON repository_collections FOR SELECT TO anon USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS item_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES repository_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_url TEXT,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE item_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions_read" ON item_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "versions_read_anon" ON item_versions FOR SELECT TO anon USING (true);
CREATE POLICY "versions_insert" ON item_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "versions_update" ON item_versions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "versions_delete" ON item_versions FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_type TEXT NOT NULL,
  items_count INTEGER DEFAULT 0,
  imported_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  error_message TEXT,
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE migration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_read" ON migration_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs_insert" ON migration_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logs_update" ON migration_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logs_delete" ON migration_logs FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_migration_logs_batch ON migration_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_repository_items_submitter ON repository_items(submitter_id);
CREATE INDEX IF NOT EXISTS idx_item_versions_item ON item_versions(item_id);

ALTER TABLE repository_items
  ADD COLUMN IF NOT EXISTS similarity_score FLOAT,
  ADD COLUMN IF NOT EXISTS ai_content_score FLOAT,
  ADD COLUMN IF NOT EXISTS matched_sources JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS plagiarism_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS copyleaks_scan_id TEXT;

ALTER TABLE theses
  ADD COLUMN IF NOT EXISTS reference_no TEXT,
  ADD COLUMN IF NOT EXISTS programme TEXT,
  ADD COLUMN IF NOT EXISTS session TEXT,
  ADD COLUMN IF NOT EXISTS declaration_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declaration_ip TEXT,
  ADD COLUMN IF NOT EXISTS similarity_score FLOAT,
  ADD COLUMN IF NOT EXISTS ai_content_score FLOAT,
  ADD COLUMN IF NOT EXISTS matched_sources JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS plagiarism_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS copyleaks_scan_id TEXT,
  ADD COLUMN IF NOT EXISTS zenodo_id TEXT,
  ADD COLUMN IF NOT EXISTS doi TEXT,
  ADD COLUMN IF NOT EXISTS repository_item_id UUID,
  ADD COLUMN IF NOT EXISTS submitter_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revision_notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_theses_reference_no ON theses(reference_no) WHERE reference_no IS NOT NULL;

ALTER TABLE theses DROP CONSTRAINT IF EXISTS theses_status_check;
ALTER TABLE theses ADD CONSTRAINT theses_status_check
  CHECK (status IN ('draft','submitted','supervisor_review','returned_to_student','committee_review','approved','rejected','published'));
ALTER TABLE theses DROP CONSTRAINT IF EXISTS theses_submission_type_check;
ALTER TABLE theses ADD CONSTRAINT theses_submission_type_check
  CHECK (submission_type IN ('thesis','dissertation','project','NCE Long Essay','Final Year Project','M.Ed. Dissertation','B.Ed. Project'));

CREATE TABLE IF NOT EXISTS thesis_supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  supervisor_name TEXT NOT NULL,
  supervisor_email TEXT NOT NULL,
  supervisor_orcid TEXT,
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','second','third')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE thesis_supervisors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_read" ON thesis_supervisors FOR SELECT TO authenticated USING (true);
CREATE POLICY "ts_insert" ON thesis_supervisors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ts_update" ON thesis_supervisors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ts_delete" ON thesis_supervisors FOR DELETE TO authenticated USING (true);

CREATE POLICY "theses_supervisor_read" ON theses FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM thesis_supervisors ts
    WHERE ts.thesis_id = theses.id
    AND ts.supervisor_email = (SELECT p.email FROM patrons p WHERE p.user_id = auth.uid() LIMIT 1)
  )
);
CREATE POLICY "theses_own_submitter" ON theses FOR SELECT TO authenticated USING (auth.uid() = submitter_id);
CREATE POLICY "theses_update_submitter" ON theses FOR UPDATE TO authenticated
  USING (auth.uid() = submitter_id)
  WITH CHECK (auth.uid() = submitter_id);

CREATE TABLE IF NOT EXISTS thesis_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  action TEXT NOT NULL,
  acted_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE thesis_workflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tw_read" ON thesis_workflow FOR SELECT TO authenticated USING (true);
CREATE POLICY "tw_insert" ON thesis_workflow FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS course_reading_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_title TEXT NOT NULL,
  course_code TEXT NOT NULL,
  department TEXT NOT NULL,
  semester TEXT NOT NULL CHECK (semester IN ('First','Second','Both')),
  session TEXT NOT NULL,
  lecturer_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE course_reading_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crl_read" ON course_reading_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "crl_insert" ON course_reading_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = lecturer_id);
CREATE POLICY "crl_update" ON course_reading_lists FOR UPDATE TO authenticated USING (auth.uid() = lecturer_id) WITH CHECK (auth.uid() = lecturer_id);
CREATE POLICY "crl_delete" ON course_reading_lists FOR DELETE TO authenticated USING (auth.uid() = lecturer_id);

CREATE TABLE IF NOT EXISTS course_reading_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES course_reading_lists(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('library','oa_article','uploaded_pdf')),
  catalogue_item_id UUID REFERENCES catalogue_items(id),
  doi TEXT,
  external_title TEXT,
  external_authors TEXT,
  external_journal TEXT,
  external_year INT,
  external_url TEXT,
  pdf_url TEXT,
  oa_pdf_url TEXT,
  reading_priority TEXT NOT NULL DEFAULT 'recommended' CHECK (reading_priority IN ('required','recommended')),
  click_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE course_reading_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crli_read" ON course_reading_list_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "crli_write" ON course_reading_list_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crli_mod" ON course_reading_list_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crli_del" ON course_reading_list_items FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS reserve_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES course_reading_list_items(id) ON DELETE CASCADE,
  patron_id UUID NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reserve_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rc_read" ON reserve_clicks FOR SELECT TO authenticated USING (true);
CREATE POLICY "rc_insert" ON reserve_clicks FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_thesis_supervisors_email ON thesis_supervisors(supervisor_email);
CREATE INDEX IF NOT EXISTS idx_thesis_supervisors_thesis ON thesis_supervisors(thesis_id);
CREATE INDEX IF NOT EXISTS idx_thesis_workflow_thesis ON thesis_workflow(thesis_id);
CREATE INDEX IF NOT EXISTS idx_crl_dept ON course_reading_lists(department);
CREATE INDEX IF NOT EXISTS idx_crli_list ON course_reading_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_reserve_clicks_item ON reserve_clicks(item_id, created_at);

CREATE TABLE IF NOT EXISTS academic_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session text NOT NULL,
  semester_one_start date,
  semester_one_end date,
  exam_one_start date,
  exam_one_end date,
  semester_two_start date,
  semester_two_end date,
  exam_two_start date,
  exam_two_end date,
  vacation_start date,
  vacation_end date,
  public_holidays jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE academic_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_academic_calendar" ON academic_calendar FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_academic_calendar" ON academic_calendar FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_academic_calendar" ON academic_calendar FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_academic_calendar" ON academic_calendar FOR DELETE TO authenticated USING (true);

ALTER TABLE catalogue_items
  ADD COLUMN IF NOT EXISTS is_harvested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recency_badge text,
  ADD COLUMN IF NOT EXISTS harvest_source text;

CREATE TABLE IF NOT EXISTS harvest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date timestamptz NOT NULL DEFAULT now(),
  subject text,
  source text,
  items_found int NOT NULL DEFAULT 0,
  items_added int NOT NULL DEFAULT 0,
  items_skipped int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE harvest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_harvest_log" ON harvest_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_harvest_log" ON harvest_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_harvest_log" ON harvest_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_harvest_log" ON harvest_log FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS content_engine_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_engine_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_engine_config" ON content_engine_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_engine_config" ON content_engine_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_engine_config" ON content_engine_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_engine_config" ON content_engine_config FOR DELETE TO authenticated USING (true);

INSERT INTO content_engine_config (subject, enabled) VALUES
  ('Early Childhood Education', true),
  ('Primary Education', true),
  ('Secondary Education', true),
  ('Curriculum Studies', true),
  ('Educational Psychology', true),
  ('Special Education', true),
  ('Christian Religious Studies', true),
  ('Islamic Studies', true),
  ('English Language Education', true),
  ('Mathematics Education', true),
  ('Science Education', true),
  ('Social Studies Education', true),
  ('Physical and Health Education', true),
  ('Business Education', true),
  ('Agricultural Science Education', true),
  ('Technical Education', true),
  ('French Language Education', true),
  ('Library and Information Science', true),
  ('Educational Administration', true)
ON CONFLICT (subject) DO NOTHING;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS body jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS comments_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE cms_pages
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Workshop',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS registration_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registrations_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS patron_name text,
  ADD COLUMN IF NOT EXISTS patron_email text;

ALTER TABLE newsletter_issues
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS recipient_scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS brevo_campaign_id text,
  ADD COLUMN IF NOT EXISTS open_rate numeric,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE databases
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS subject_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'Journals',
  ADD COLUMN IF NOT EXISTS dept_availability text[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS cms_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nav_type text NOT NULL DEFAULT 'main',
  items jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cms_menu ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_menu_select_auth" ON cms_menu FOR SELECT TO authenticated USING (true);
CREATE POLICY "cms_menu_select_anon" ON cms_menu FOR SELECT TO anon USING (true);
CREATE POLICY "cms_menu_insert" ON cms_menu FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cms_menu_update" ON cms_menu FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cms_menu_delete" ON cms_menu FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  patron_id uuid REFERENCES patrons(id),
  author_name text NOT NULL,
  content text NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_comments_auth_select" ON blog_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "blog_comments_anon_select" ON blog_comments FOR SELECT TO anon USING (is_approved = true);
CREATE POLICY "blog_comments_insert_auth" ON blog_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "blog_comments_insert_anon" ON blog_comments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "blog_comments_update" ON blog_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "blog_comments_delete" ON blog_comments FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS database_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  patron_name text NOT NULL,
  patron_email text NOT NULL,
  department text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE database_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "db_req_anon_insert" ON database_access_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "db_req_auth_insert" ON database_access_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "db_req_auth_select" ON database_access_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "db_req_update" ON database_access_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "db_req_delete" ON database_access_requests FOR DELETE TO authenticated USING (true);

INSERT INTO cms_menu (nav_type, items) VALUES
  ('main', '[{"id":"1","label":"Home","url":"/","type":"page"},{"id":"2","label":"Catalogue","url":"/catalogue","type":"page"},{"id":"3","label":"Repository","url":"/repository","type":"page"},{"id":"4","label":"Databases","url":"/databases","type":"page"},{"id":"5","label":"Blog","url":"/blog","type":"page"},{"id":"6","label":"Events","url":"/events","type":"page"}]'),
  ('footer', '[{"id":"f1","label":"About","url":"/about","type":"page"},{"id":"f2","label":"Contact","url":"/contact","type":"page"},{"id":"f3","label":"Privacy Policy","url":"/privacy","type":"page"},{"id":"f4","label":"Terms of Use","url":"/terms","type":"page"},{"id":"f5","label":"Accessibility","url":"/accessibility","type":"page"},{"id":"f6","label":"FAQ","url":"/faq","type":"page"}]')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id)
);
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "librarians_manage_snapshots" ON report_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  librarian_id uuid REFERENCES auth.users(id),
  patron_id uuid,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "librarians_read_access_log" ON admin_access_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "librarians_insert_access_log" ON admin_access_log FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE patrons ADD COLUMN IF NOT EXISTS deletion_requested boolean NOT NULL DEFAULT false;
ALTER TABLE patrons ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_access_log_patron ON admin_access_log (patron_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_librarian ON admin_access_log (librarian_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_section ON report_snapshots (section, recorded_at DESC);

CREATE TABLE IF NOT EXISTS researcher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patron_id uuid REFERENCES patrons(id) ON DELETE CASCADE,
  salutation text,
  first_name text NOT NULL,
  middle_name text,
  surname text NOT NULL,
  academic_rank text,
  employment_status text,
  department text,
  programmes_taught text[] DEFAULT '{}',
  institution text DEFAULT 'Adeyemi Federal University of Education',
  institutional_email text,
  phone text,
  office_location text,
  highest_qualification jsonb,
  other_qualifications jsonb[] DEFAULT '{}',
  professional_memberships text[] DEFAULT '{}',
  specialisations text[] DEFAULT '{}',
  research_keywords text[] DEFAULT '{}',
  biography text,
  orcid_id text,
  orcid_verified boolean DEFAULT false,
  google_scholar_id text,
  researchgate_url text,
  academia_url text,
  scopus_id text,
  h_index int,
  total_citations int,
  i10_index int,
  supervision_phd_completed int DEFAULT 0,
  supervision_phd_current int DEFAULT 0,
  supervision_med_completed int DEFAULT 0,
  supervision_med_current int DEFAULT 0,
  profile_photo_url text,
  visibility text DEFAULT 'public',
  status text DEFAULT 'draft',
  return_notes text,
  slug text UNIQUE,
  last_updated_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE researcher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "researcher_profiles_select" ON researcher_profiles FOR SELECT
  USING (
    (status = 'published' AND visibility = 'public')
    OR patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid())
  );
CREATE POLICY "researcher_profiles_insert" ON researcher_profiles FOR INSERT TO authenticated
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));
CREATE POLICY "researcher_profiles_update" ON researcher_profiles FOR UPDATE TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()))
  WITH CHECK (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()));
CREATE POLICY "researcher_profiles_delete" ON researcher_profiles FOR DELETE TO authenticated
  USING (patron_id IN (SELECT id FROM patrons WHERE user_id = auth.uid()) AND status = 'draft');

CREATE TABLE IF NOT EXISTS researcher_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id uuid REFERENCES researcher_profiles(id) ON DELETE CASCADE,
  title text,
  funding_body text,
  amount text,
  year int,
  role text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE researcher_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "researcher_grants_select" ON researcher_grants FOR SELECT
  USING (
    researcher_id IN (SELECT id FROM researcher_profiles WHERE status = 'published' AND visibility = 'public')
    OR researcher_id IN (SELECT rp.id FROM researcher_profiles rp JOIN patrons p ON p.id = rp.patron_id WHERE p.user_id = auth.uid())
  );
CREATE POLICY "researcher_grants_insert" ON researcher_grants FOR INSERT TO authenticated
  WITH CHECK (researcher_id IN (SELECT rp.id FROM researcher_profiles rp JOIN patrons p ON p.id = rp.patron_id WHERE p.user_id = auth.uid()));
CREATE POLICY "researcher_grants_update" ON researcher_grants FOR UPDATE TO authenticated
  USING (researcher_id IN (SELECT rp.id FROM researcher_profiles rp JOIN patrons p ON p.id = rp.patron_id WHERE p.user_id = auth.uid()));
CREATE POLICY "researcher_grants_delete" ON researcher_grants FOR DELETE TO authenticated
  USING (researcher_id IN (SELECT rp.id FROM researcher_profiles rp JOIN patrons p ON p.id = rp.patron_id WHERE p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_researcher_profiles_patron ON researcher_profiles(patron_id);
CREATE INDEX IF NOT EXISTS idx_researcher_profiles_status ON researcher_profiles(status);
CREATE INDEX IF NOT EXISTS idx_researcher_profiles_slug ON researcher_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_researcher_grants_researcher ON researcher_grants(researcher_id);