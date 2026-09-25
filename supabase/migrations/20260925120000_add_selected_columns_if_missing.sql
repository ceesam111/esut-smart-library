-- Defensive column additions for columns selected by application API routes.
-- Safe to run repeatedly.
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS issn text;
ALTER TABLE public.repository_items ADD COLUMN IF NOT EXISTS handle text;
ALTER TABLE public.repository_items ADD COLUMN IF NOT EXISTS license text;
