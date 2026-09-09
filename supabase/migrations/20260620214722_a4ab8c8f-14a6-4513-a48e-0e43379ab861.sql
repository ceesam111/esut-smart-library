CREATE TABLE public.doab_books_cache (
  id text PRIMARY KEY DEFAULT 'singleton',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.doab_books_cache TO anon, authenticated;
GRANT ALL ON public.doab_books_cache TO service_role;

ALTER TABLE public.doab_books_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read DOAB cache"
ON public.doab_books_cache
FOR SELECT
TO anon, authenticated
USING (true);