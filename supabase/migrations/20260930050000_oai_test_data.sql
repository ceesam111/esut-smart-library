-- OAI-PMH test data for protocol validation
-- These are safe staging records for testing OAI harvesting

insert into repository_items (id, title, authors, abstract, item_type, status, visibility, year, submitter_id)
values
  ('11111111-1111-1111-1111-111111111111', 'Test Article: Machine Learning in Libraries', '["Dr. A. Smith", "Prof. B. Jones"]', 'A study of ML applications in academic libraries.', 'article', 'published', 'global', 2024, null),
  ('22222222-2222-2222-2222-222222222222', 'Test Thesis: Data Science Education', '["Student C. Brown"]', 'An analysis of data science curricula.', 'thesis', 'published', 'global', 2023, null),
  ('33333333-3333-3333-3333-333333333333', 'Test Dataset: Library Usage Statistics', '["Dr. D. Wilson"]', 'Anonymous usage statistics from 2020-2024.', 'dataset', 'published', 'global', 2024, null),
  ('44444444-4444-4444-4444-444444444444', 'Embargoed Article: Ongoing Research', '["Dr. E. Taylor"]', 'Research in progress, available after 2026.', 'article', 'published', 'global', 2025, null)
on conflict (id) do nothing;

update repository_items set embargo_until = '2026-06-01' where id = '44444444-4444-4444-4444-444444444444';

insert into repository_files (repository_item_id, storage_bucket, storage_key, original_filename, mime_type, file_size, role, access_level, uploader_id)
values
  ('11111111-1111-1111-1111-111111111111', 'repository', 'test/article-1.pdf', 'article-1.pdf', 'application/pdf', 1024, 'ORIGINAL', 'PUBLIC', null),
  ('22222222-2222-2222-2222-222222222222', 'repository', 'test/thesis-1.pdf', 'thesis-1.pdf', 'application/pdf', 2048, 'ORIGINAL', 'PUBLIC', null),
  ('33333333-3333-3333-3333-333333333333', 'repository', 'test/dataset-1.csv', 'dataset-1.csv', 'text/csv', 512, 'DATASET', 'PUBLIC', null)
on conflict (repository_item_id, storage_key) do nothing;
