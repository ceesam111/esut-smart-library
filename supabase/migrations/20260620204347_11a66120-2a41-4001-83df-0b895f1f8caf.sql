-- ===== Webometrics admin =====
CREATE TABLE IF NOT EXISTS public.webometrics_ranks (
  initiative_key text PRIMARY KEY,
  rank_text      text,
  rank_year      int,
  updated_at     timestamptz DEFAULT now()
);
GRANT SELECT ON public.webometrics_ranks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webometrics_ranks TO authenticated;
GRANT ALL ON public.webometrics_ranks TO service_role;
ALTER TABLE public.webometrics_ranks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webo_ranks_read_anon" ON public.webometrics_ranks FOR SELECT TO anon USING (true);
CREATE POLICY "webo_ranks_read_auth" ON public.webometrics_ranks FOR SELECT TO authenticated USING (true);
CREATE POLICY "webo_ranks_write" ON public.webometrics_ranks FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin');
INSERT INTO public.webometrics_ranks (initiative_key, rank_text, rank_year) VALUES
  ('ncce','Not yet ranked',NULL),('webometrics','Not yet ranked',NULL),('the','Not yet ranked',NULL),
  ('qs','Not yet ranked',NULL),('google_scholar','Not yet ranked',NULL),('scimago','Not yet ranked',NULL),
  ('ui_greenmetric','Not yet ranked',NULL),('nirf','Not yet ranked',NULL)
ON CONFLICT (initiative_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.webometrics_actions (
  action_id int PRIMARY KEY,
  status    text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','done'))
);
GRANT SELECT ON public.webometrics_actions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webometrics_actions TO authenticated;
GRANT ALL ON public.webometrics_actions TO service_role;
ALTER TABLE public.webometrics_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webo_actions_read_anon" ON public.webometrics_actions FOR SELECT TO anon USING (true);
CREATE POLICY "webo_actions_read_auth" ON public.webometrics_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "webo_actions_write" ON public.webometrics_actions FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin') WITH CHECK (auth.jwt() ->> 'role' = 'admin');
INSERT INTO public.webometrics_actions (action_id, status) VALUES
  (1,'not_started'),(2,'done'),(3,'done'),(4,'not_started'),(5,'in_progress'),(6,'in_progress'),
  (7,'not_started'),(8,'not_started'),(9,'not_started'),(10,'not_started'),(11,'not_started'),
  (12,'not_started'),(13,'in_progress'),(14,'not_started'),(15,'not_started')
ON CONFLICT (action_id) DO NOTHING;

-- ===== User notifications =====
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text,
  type text NOT NULL DEFAULT 'system',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON public.user_notifications(user_id, is_read, created_at DESC);
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_notifs" ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "update_own_notifs" ON public.user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insert_own_notifs" ON public.user_notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_notifs" ON public.user_notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service_insert_notifs" ON public.user_notifications FOR INSERT TO service_role WITH CHECK (true);

-- ===== updated_at helper =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ===== Authority control =====
CREATE TABLE IF NOT EXISTS public.authority_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  term_type text NOT NULL CHECK (term_type IN ('author','subject','series','corporate','geographic')),
  variants text[] DEFAULT '{}',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authority_control TO authenticated;
GRANT ALL ON public.authority_control TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS authority_term_type_unique ON public.authority_control (lower(term), term_type);
ALTER TABLE public.authority_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authority_read" ON public.authority_control FOR SELECT TO authenticated USING (true);
CREATE POLICY "authority_insert" ON public.authority_control FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "authority_update" ON public.authority_control FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "authority_delete" ON public.authority_control FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
CREATE TRIGGER authority_updated_at BEFORE UPDATE ON public.authority_control FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Circulation transactions =====
CREATE TABLE IF NOT EXISTS public.circulation_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL CHECK (transaction_type IN ('checkout','checkin','renew')),
  patron_id uuid REFERENCES public.patrons(id) ON DELETE SET NULL,
  catalogue_item_id uuid REFERENCES public.catalogue_items(id) ON DELETE SET NULL,
  copy_barcode text,
  loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz DEFAULT now(),
  notes text DEFAULT '',
  offline_id text,
  synced_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circulation_transactions TO authenticated;
GRANT ALL ON public.circulation_transactions TO service_role;
ALTER TABLE public.circulation_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "circ_select" ON public.circulation_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "circ_insert" ON public.circulation_transactions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "circ_update" ON public.circulation_transactions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "circ_delete" ON public.circulation_transactions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.librarians WHERE user_id = auth.uid() AND is_active = true));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='notify_sent') THEN
    ALTER TABLE public.reservations ADD COLUMN notify_sent boolean DEFAULT false;
  END IF;
END $$;

-- ===== Library shelves =====
CREATE TABLE IF NOT EXISTS public.library_shelves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_code text UNIQUE NOT NULL,
  library_code text NOT NULL,
  library_name text NOT NULL,
  library_slug text NOT NULL,
  floor_room text NOT NULL,
  bay text NOT NULL,
  shelf_number text NOT NULL,
  description text,
  subject_range text,
  capacity int NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_shelves TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_shelves TO authenticated;
GRANT ALL ON public.library_shelves TO service_role;
ALTER TABLE public.library_shelves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shelves_select_all" ON public.library_shelves FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "shelves_insert_auth" ON public.library_shelves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shelves_update_auth" ON public.library_shelves FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shelves_delete_auth" ON public.library_shelves FOR DELETE TO authenticated USING (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalogue_items' AND column_name='library_slug') THEN ALTER TABLE public.catalogue_items ADD COLUMN library_slug text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalogue_items' AND column_name='library_code') THEN ALTER TABLE public.catalogue_items ADD COLUMN library_code text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalogue_items' AND column_name='shelf_code') THEN ALTER TABLE public.catalogue_items ADD COLUMN shelf_code text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalogue_items' AND column_name='location_notes') THEN ALTER TABLE public.catalogue_items ADD COLUMN location_notes text; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalogue_items' AND column_name='visibility') THEN
    ALTER TABLE public.catalogue_items ADD COLUMN visibility text NOT NULL DEFAULT 'global' CHECK (visibility IN ('global','members','private'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='catalogue_copies' AND column_name='shelf_location') THEN
    ALTER TABLE public.catalogue_copies ADD COLUMN shelf_location text;
  END IF;
END $$;

INSERT INTO public.library_shelves (shelf_code, library_code, library_name, library_slug, floor_room, bay, shelf_number, description, subject_range, capacity) VALUES
  ('BFL/GF/B01/SH01','BFL','Baxter Foundation Library','bfl','GF','01','01','Ground Floor — General Reference','General Reference',40),
  ('BFL/GF/B01/SH02','BFL','Baxter Foundation Library','bfl','GF','01','02','Ground Floor — General Reference','Encyclopaedias & Dictionaries',40),
  ('BFL/GF/B02/SH01','BFL','Baxter Foundation Library','bfl','GF','02','01','Ground Floor — New Arrivals','New Arrivals',30),
  ('BFL/GF/B02/SH02','BFL','Baxter Foundation Library','bfl','GF','02','02','Ground Floor — Periodicals','Journals & Magazines',50),
  ('BFL/F1/B01/SH01','BFL','Baxter Foundation Library','bfl','F1','01','01','First Floor — Science','Pure Sciences',60),
  ('BFL/F1/B01/SH02','BFL','Baxter Foundation Library','bfl','F1','01','02','First Floor — Science','Applied Sciences',60),
  ('BFL/F1/B02/SH01','BFL','Baxter Foundation Library','bfl','F1','02','01','First Floor — Humanities','Arts & Humanities',50),
  ('BFL/F1/B02/SH02','BFL','Baxter Foundation Library','bfl','F1','02','02','First Floor — Social Sciences','Social Sciences',50),
  ('BFL/F2/B01/SH01','BFL','Baxter Foundation Library','bfl','F2','01','01','Second Floor — Special Collections','Special Collections',25),
  ('BFL/F2/B01/SH02','BFL','Baxter Foundation Library','bfl','F2','01','02','Second Floor — Theses & Dissertations','Theses & Dissertations',35)
ON CONFLICT (shelf_code) DO NOTHING;

-- ===== In-app forum =====
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '💬',
  description text,
  slug text UNIQUE NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_staff_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_categories TO authenticated;
GRANT ALL ON public.forum_categories TO service_role;

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  reply_count int NOT NULL DEFAULT 0,
  views int NOT NULL DEFAULT 0,
  last_post_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_threads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_threads TO authenticated;
GRANT ALL ON public.forum_threads TO service_role;
CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON public.forum_threads(category_id, last_post_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_user ON public.forum_threads(user_id);

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  is_edited boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_posts TO authenticated;
GRANT ALL ON public.forum_posts TO service_role;
CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON public.forum_posts(thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.forum_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
GRANT SELECT ON public.forum_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_reactions TO authenticated;
GRANT ALL ON public.forum_reactions TO service_role;

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_categories" ON public.forum_categories FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_threads" ON public.forum_threads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_insert_threads" ON public.forum_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_update_threads" ON public.forum_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.librarians WHERE librarians.user_id = auth.uid())) WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.librarians WHERE librarians.user_id = auth.uid()));
CREATE POLICY "auth_delete_threads" ON public.forum_threads FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.librarians WHERE librarians.user_id = auth.uid()));

CREATE POLICY "public_read_posts" ON public.forum_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_insert_posts" ON public.forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_update_posts" ON public.forum_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_posts" ON public.forum_posts FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.librarians WHERE librarians.user_id = auth.uid()));

CREATE POLICY "public_read_reactions" ON public.forum_reactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_insert_reactions" ON public.forum_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_reactions" ON public.forum_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.forum_categories (name, icon, description, slug, sort_order) VALUES
  ('General Library','📚','Announcements, general questions, and discussions.','general',1),
  ('Research Support','🔬','Ask for research help, databases, and literature reviews.','research',2),
  ('NUC Project Support','📝','NUC programme topics, funding calls, and project discussions.','nuc-projects',3),
  ('Librarians Corner','🏛️','Professional development, cataloguing, and policy discussions.','librarians',4),
  ('Thesis & Repository','🎓','Thesis submission questions and open-access publishing.','thesis',5),
  ('Feedback & Ideas','💡','Suggest improvements to the library and digital services.','feedback',6)
ON CONFLICT (slug) DO NOTHING;