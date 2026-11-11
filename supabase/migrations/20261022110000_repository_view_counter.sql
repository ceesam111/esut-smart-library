-- T08: atomic server-side view/download counters for repository items.
-- The dashboard previously performed a client-side read-modify-write on
-- view_count/download_count, which raced under concurrency and could be
-- inflated by scripted clients. These SECURITY DEFINER functions make the
-- increment atomic, restrict counting to published items, and are granted
-- only to service_role: all counting flows through POST /api/repository/[id]/view,
-- which applies bot classification and per-IP deduplication before calling them.

create or replace function public.increment_repository_view_count(p_item_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.repository_items
     set view_count = coalesce(view_count, 0) + 1
   where id = p_item_id
     and status = 'published'
  returning view_count into new_count;
  return coalesce(new_count, 0);
end;
$$;

create or replace function public.increment_repository_download_count(p_item_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.repository_items
     set download_count = coalesce(download_count, 0) + 1
   where id = p_item_id
     and status = 'published'
  returning download_count into new_count;
  return coalesce(new_count, 0);
end;
$$;

revoke all on function public.increment_repository_view_count(uuid) from public, anon, authenticated;
revoke all on function public.increment_repository_download_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_repository_view_count(uuid) to service_role;
grant execute on function public.increment_repository_download_count(uuid) to service_role;
