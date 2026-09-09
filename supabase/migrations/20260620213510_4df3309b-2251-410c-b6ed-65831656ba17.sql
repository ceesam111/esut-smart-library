INSERT INTO public.databases (name, description, url, provider, type, coverage, access_type, content_type, subject_tags, subjects, is_active)
SELECT
  'Research4Life',
  'Public-private partnership providing institutions in low- and middle-income countries with free or low-cost access to peer-reviewed content in health, agriculture, environment, law, and nutrition.',
  'https://www.research4life.org',
  'Research4Life',
  'fulltext',
  'Multidisciplinary peer-reviewed content',
  'campus',
  'Multidisciplinary',
  ARRAY['Health','Agriculture','Environment','Law','Nutrition'],
  '["Health","Agriculture","Environment","Law","Nutrition"]'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.databases WHERE name = 'Research4Life');