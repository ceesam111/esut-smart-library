-- ── Social feed: user posts + moderation ──────────────────────────────────────
-- Moderation columns on feed_events (soft-remove by librarians)
ALTER TABLE public.feed_events
  ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_by uuid,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- Allow librarians / faculty librarians / super admins to moderate (soft-remove) any post
DROP POLICY IF EXISTS feed_events_moderate ON public.feed_events;
CREATE POLICY feed_events_moderate ON public.feed_events
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Allow librarians to hard-delete posts too
DROP POLICY IF EXISTS feed_events_moderate_delete ON public.feed_events;
CREATE POLICY feed_events_moderate_delete ON public.feed_events
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ── Reports table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_event_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.feed_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.feed_event_reports TO authenticated;
GRANT ALL ON public.feed_event_reports TO service_role;

ALTER TABLE public.feed_event_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can create their own reports
CREATE POLICY reports_insert ON public.feed_event_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Reporters can see/withdraw their own; librarians can see all reports
CREATE POLICY reports_select ON public.feed_event_reports
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY reports_delete ON public.feed_event_reports
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'librarian')
    OR public.has_role(auth.uid(), 'faculty_librarian')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Index for moderation queue
CREATE INDEX IF NOT EXISTS idx_feed_event_reports_event ON public.feed_event_reports(event_id);