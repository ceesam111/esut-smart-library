-- Rollback for 20261022110000_repository_view_counter.sql
-- Removes the atomic counter functions. Existing view_count/download_count
-- values in repository_items are preserved as plain integers.

drop function if exists public.increment_repository_view_count(uuid);
drop function if exists public.increment_repository_download_count(uuid);
