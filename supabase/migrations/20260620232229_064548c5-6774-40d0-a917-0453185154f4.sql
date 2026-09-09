-- ============ newspaper_serials ============
CREATE TABLE public.newspaper_serials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  url text,
  rss_url text,
  description text,
  zone text,
  state text,
  country text,
  continent text,
  category text,
  language text DEFAULT 'English',
  call_number text,
  issn text,
  frequency text DEFAULT 'Daily',
  branch_origin text,
  is_active boolean NOT NULL DEFAULT true,
  last_harvested_at timestamp with time zone,
  article_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.newspaper_serials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newspaper_serials TO authenticated;
GRANT ALL ON public.newspaper_serials TO service_role;

ALTER TABLE public.newspaper_serials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read newspaper serials"
  ON public.newspaper_serials FOR SELECT
  USING (true);

CREATE POLICY "Librarians can insert newspaper serials"
  ON public.newspaper_serials FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Librarians can update newspaper serials"
  ON public.newspaper_serials FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Librarians can delete newspaper serials"
  ON public.newspaper_serials FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER trg_newspaper_serials_updated_at
  BEFORE UPDATE ON public.newspaper_serials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_newspaper_serials_country ON public.newspaper_serials(country);
CREATE INDEX idx_newspaper_serials_category ON public.newspaper_serials(category);
CREATE INDEX idx_newspaper_serials_active ON public.newspaper_serials(is_active);

-- ============ newspaper_articles ============
CREATE TABLE public.newspaper_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_id uuid NOT NULL REFERENCES public.newspaper_serials(id) ON DELETE CASCADE,
  title text NOT NULL,
  link text,
  summary text,
  author text,
  published_at timestamp with time zone,
  guid text NOT NULL,
  subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  indexing_status text NOT NULL DEFAULT 'auto',
  indexed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  indexed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (serial_id, guid)
);

GRANT SELECT ON public.newspaper_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newspaper_articles TO authenticated;
GRANT ALL ON public.newspaper_articles TO service_role;

ALTER TABLE public.newspaper_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read newspaper articles"
  ON public.newspaper_articles FOR SELECT
  USING (true);

CREATE POLICY "Librarians can insert newspaper articles"
  ON public.newspaper_articles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Librarians can update newspaper articles"
  ON public.newspaper_articles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Librarians can delete newspaper articles"
  ON public.newspaper_articles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER trg_newspaper_articles_updated_at
  BEFORE UPDATE ON public.newspaper_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_newspaper_articles_serial ON public.newspaper_articles(serial_id);
CREATE INDEX idx_newspaper_articles_published ON public.newspaper_articles(published_at DESC);
CREATE INDEX idx_newspaper_articles_title ON public.newspaper_articles USING gin (to_tsvector('english', title));

-- ============ article_count maintenance ============
CREATE OR REPLACE FUNCTION public.sync_newspaper_article_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.newspaper_serials
      SET article_count = article_count + 1
      WHERE id = NEW.serial_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.newspaper_serials
      SET article_count = GREATEST(article_count - 1, 0)
      WHERE id = OLD.serial_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_article_count
  AFTER INSERT OR DELETE ON public.newspaper_articles
  FOR EACH ROW EXECUTE FUNCTION public.sync_newspaper_article_count();