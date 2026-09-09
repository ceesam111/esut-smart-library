CREATE TABLE public.integrity_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scan_type text NOT NULL DEFAULT 'plagiarism',
  title text,
  word_count integer NOT NULL DEFAULT 0,
  similarity_score double precision,
  ai_content_score double precision,
  matched_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  flagged_passages jsonb NOT NULL DEFAULT '[]'::jsonb,
  citation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  citation_count integer NOT NULL DEFAULT 0,
  outdated_count integer NOT NULL DEFAULT 0,
  citation_style text DEFAULT 'APA 7th',
  repository_item_id uuid REFERENCES public.repository_items(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrity_scans TO authenticated;
GRANT ALL ON public.integrity_scans TO service_role;

ALTER TABLE public.integrity_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scans"
  ON public.integrity_scans FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Users can create their own scans"
  ON public.integrity_scans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scans"
  ON public.integrity_scans FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER trg_integrity_scans_updated_at
  BEFORE UPDATE ON public.integrity_scans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_integrity_scans_user ON public.integrity_scans(user_id);
CREATE INDEX idx_integrity_scans_type ON public.integrity_scans(scan_type);
CREATE INDEX idx_integrity_scans_repo ON public.integrity_scans(repository_item_id);