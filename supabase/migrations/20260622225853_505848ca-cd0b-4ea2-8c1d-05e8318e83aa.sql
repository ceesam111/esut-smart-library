CREATE TABLE public.patron_saved_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patron_id uuid NOT NULL REFERENCES public.patrons(id) ON DELETE CASCADE,
  title text NOT NULL,
  authors text,
  year integer,
  doi text,
  url text,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patron_saved_items TO authenticated;
GRANT ALL ON public.patron_saved_items TO service_role;

ALTER TABLE public.patron_saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved items"
  ON public.patron_saved_items
  FOR ALL
  TO authenticated
  USING (patron_id IN (SELECT id FROM public.patrons WHERE user_id = auth.uid()))
  WITH CHECK (patron_id IN (SELECT id FROM public.patrons WHERE user_id = auth.uid()));

CREATE TRIGGER set_patron_saved_items_updated_at
  BEFORE UPDATE ON public.patron_saved_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_patron_saved_items_patron ON public.patron_saved_items(patron_id);