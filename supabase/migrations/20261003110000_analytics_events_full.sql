-- Update analytics_events table for full event taxonomy
alter table analytics_events drop constraint if exists analytics_events_event_type_check;

alter table analytics_events add constraint analytics_events_event_type_check check (event_type in (
  'page_view', 'search', 'download', 'view_item', 'login', 'register',
  'catalogue_view', 'catalogue_search', 'catalogue_result_click', 'catalogue_export',
  'repository_item_view', 'repository_search', 'repository_result_click',
  'repository_file_download', 'repository_submission', 'repository_publication',
  'checkout', 'checkin', 'renewal', 'hold_placed', 'hold_fulfilled', 'hold_cancelled', 'overdue',
  'event_view', 'event_registration', 'blog_view', 'forum_activity',
  'federated_search', 'federated_result_click', 'provider_result_click',
  'ai_session_started', 'ai_query'
));

alter table analytics_events add column if not exists entity_type text;
alter table analytics_events add column if not exists entity_id text;
alter table analytics_events add column if not exists search_query text;
alter table analytics_events add column if not exists provider text;
alter table analytics_events add column if not exists bot_flag text;
alter table analytics_events add column if not exists event_category text;
alter table analytics_events add column if not exists faculty text;
alter table analytics_events add column if not exists department text;
alter table analytics_events add column if not exists patron_role text;
alter table analytics_events add column if not exists result_count integer;
alter table analytics_events add column if not exists session_token text;

create index if not exists idx_analytics_events_entity on analytics_events(entity_type, entity_id);
create index if not exists idx_analytics_events_bot on analytics_events(bot_flag);
create index if not exists idx_analytics_events_category on analytics_events(event_category);
create index if not exists idx_analytics_events_faculty on analytics_events(faculty);
create index if not exists idx_analytics_events_session on analytics_events(session_token);

-- Update RLS: analytics reads restricted to admin roles
drop policy if exists "analytics_events_select_staff" on analytics_events;
create policy "analytics_events_admin_read" on analytics_events for select to authenticated
  using (exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('super_admin', 'librarian', 'catalog_admin')
  ));
