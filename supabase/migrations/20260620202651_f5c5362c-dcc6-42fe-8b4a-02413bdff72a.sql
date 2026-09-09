create extension if not exists "uuid-ossp";

create table patrons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  patron_id text unique not null,
  full_name text not null,
  email text not null,
  phone text,
  date_of_birth date,
  gender text,
  patron_category text not null,
  faculty_code text,
  faculty_name text,
  department text,
  level text,
  programme text,
  matric_number text,
  staff_id text,
  rank text,
  status text not null default 'active' check (status in ('active', 'suspended', 'expired')),
  membership_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table patrons enable row level security;
create policy "patrons_select_own" on patrons for select to authenticated using (auth.uid() = user_id);
create policy "patrons_update_own" on patrons for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table catalogue_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors jsonb not null default '[]',
  isbn text,
  publisher text,
  year int,
  edition text,
  subjects jsonb default '[]',
  call_number text,
  format text not null default 'Book',
  language text default 'English',
  abstract text,
  cover_image text,
  faculty_code text,
  total_copies int not null default 1,
  available_copies int not null default 1,
  marc21 jsonb,
  view_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table catalogue_items enable row level security;
create policy "catalogue_read" on catalogue_items for select to authenticated using (true);
create policy "catalogue_write" on catalogue_items for all to authenticated using (auth.jwt() ->> 'role' = 'admin');

create table repository_communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  faculty_code text,
  logo_url text,
  parent_id uuid references repository_communities(id),
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table repository_communities enable row level security;
create policy "communities_read" on repository_communities for select to authenticated using (true);

create table repository_collections (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references repository_communities(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table repository_collections enable row level security;
create policy "collections_read" on repository_collections for select to authenticated using (true);

create table repository_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors jsonb not null default '[]',
  abstract text,
  type text not null default 'Article',
  subjects jsonb default '[]',
  keywords jsonb default '[]',
  year int,
  language text default 'English',
  faculty_code text,
  community_id uuid references repository_communities(id),
  collection_id uuid references repository_collections(id),
  orcid_ids jsonb default '[]',
  doi text,
  file_url text,
  file_size bigint,
  embargo_until timestamptz,
  visibility text not null default 'global' check (visibility in ('global', 'faculty', 'private')),
  status text not null default 'submitted' check (status in ('submitted', 'review', 'approved', 'published', 'rejected')),
  view_count int default 0,
  download_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table repository_items enable row level security;
create policy "repo_items_read" on repository_items for select to authenticated using (status = 'published' or auth.jwt() ->> 'role' = 'admin');

create table loans (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references patrons(id) on delete cascade,
  catalogue_item_id uuid not null references catalogue_items(id),
  checkout_date timestamptz not null default now(),
  due_date timestamptz not null,
  return_date timestamptz,
  renewed_count int default 0,
  status text not null default 'active' check (status in ('active', 'returned', 'overdue', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table loans enable row level security;
create policy "loans_select_own" on loans for select to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = loans.patron_id)
);
create policy "loans_insert" on loans for insert to authenticated with check (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = loans.patron_id)
);

create table loan_fines (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  amount decimal(10,2) not null,
  reason text not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table loan_fines enable row level security;
create policy "fines_read_own" on loan_fines for select to authenticated using (
  exists (select 1 from loans join patrons on loans.patron_id = patrons.id where loans.id = loan_fines.loan_id and patrons.user_id = auth.uid())
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references patrons(id) on delete cascade,
  catalogue_item_id uuid not null references catalogue_items(id),
  reservation_date timestamptz not null default now(),
  expiry_date timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled', 'expired')),
  priority int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table reservations enable row level security;
create policy "reservations_own" on reservations for select to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = reservations.patron_id)
);

create table ill_requests (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references patrons(id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  publisher text,
  year text,
  request_type text not null default 'borrow' check (request_type in ('borrow', 'copy', 'article')),
  status text not null default 'pending' check (status in ('pending', 'submitted', 'fulfilled', 'cancelled')),
  notes text,
  lending_institution text,
  estimated_arrival date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table ill_requests enable row level security;
create policy "ill_own" on ill_requests for select to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = ill_requests.patron_id)
);

create table reading_lists (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references patrons(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table reading_lists enable row level security;
create policy "reading_lists_own" on reading_lists for all to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = reading_lists.patron_id)
);

create table reading_list_items (
  id uuid primary key default gen_random_uuid(),
  reading_list_id uuid not null references reading_lists(id) on delete cascade,
  catalogue_item_id uuid not null references catalogue_items(id),
  notes text,
  sort_order int default 0,
  created_at timestamptz not null default now()
);
alter table reading_list_items enable row level security;
create policy "rli_own" on reading_list_items for all to authenticated using (
  exists (select 1 from reading_lists join patrons on reading_lists.patron_id = patrons.id 
         where reading_lists.id = reading_list_items.reading_list_id and patrons.user_id = auth.uid())
);

create table theses (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references patrons(id) on delete cascade,
  title text not null,
  abstract text,
  keywords jsonb default '[]',
  degree text not null,
  department text not null,
  supervisor text not null,
  co_supervisors jsonb default '[]',
  submission_type text not null default 'thesis' check (submission_type in ('thesis', 'dissertation', 'project')),
  language text default 'English',
  year int not null,
  pages int,
  file_url text,
  file_size bigint,
  plagiariism_score decimal(5,2),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'corrections', 'approved', 'rejected', 'published')),
  visibility text not null default 'private' check (visibility in ('private', 'faculty', 'global')),
  submission_date timestamptz,
  approval_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table theses enable row level security;
create policy "theses_own" on theses for all to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = theses.patron_id)
);

create table thesis_reviews (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references theses(id) on delete cascade,
  reviewer_id uuid references patrons(id),
  reviewer_name text not null,
  comments text,
  grade text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'corrections_required', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table thesis_reviews enable row level security;
create policy "thesis_reviews_admin" on thesis_reviews for all to authenticated using (auth.jwt() ->> 'role' in ('admin', 'supervisor'));

create table course_reserves (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  course_title text not null,
  instructor text not null,
  department text,
  semester text not null,
  session text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table course_reserves enable row level security;
create policy "course_reserves_read" on course_reserves for select to authenticated using (true);

create table course_reserve_items (
  id uuid primary key default gen_random_uuid(),
  course_reserve_id uuid not null references course_reserves(id) on delete cascade,
  catalogue_item_id uuid references catalogue_items(id),
  custom_title text,
  custom_author text,
  note text,
  created_at timestamptz not null default now()
);
alter table course_reserve_items enable row level security;
create policy "cri_read" on course_reserve_items for select to authenticated using (true);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'workshop' check (event_type in ('workshop', 'training', 'seminar', 'meeting', 'other')),
  venue text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_virtual boolean default false,
  virtual_url text,
  max_attendees int,
  image_url text,
  status text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table events enable row level security;
create policy "events_read" on events for select to authenticated using (true);

create table event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  patron_id uuid not null references patrons(id) on delete cascade,
  registered_at timestamptz not null default now(),
  attended boolean default false,
  unique(event_id, patron_id)
);
alter table event_registrations enable row level security;
create policy "event_reg_own" on event_registrations for all to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = event_registrations.patron_id)
);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  excerpt text,
  content text not null,
  author_name text not null,
  featured_image text,
  category text,
  tags jsonb default '[]',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  view_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table blog_posts enable row level security;
create policy "blog_read_published" on blog_posts for select to authenticated using (status = 'published' or auth.jwt() ->> 'role' = 'admin');

create table newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  issue_number int not null,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'scheduled')),
  sent_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table newsletter_issues enable row level security;
create policy "newsletter_admin" on newsletter_issues for all to authenticated using (auth.jwt() ->> 'role' = 'admin');

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'unsubscribed', 'bounced'))
);
alter table newsletter_subscribers enable row level security;
create policy "subscribers_admin" on newsletter_subscribers for all to authenticated using (auth.jwt() ->> 'role' = 'admin');

create table databases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  url text not null,
  provider text not null,
  type text not null default 'indexed' check (type in ('indexed', 'fulltext', 'reference', 'multimedia')),
  coverage text,
  subjects jsonb default '[]',
  access_type text not null default 'campus' check (access_type in ('open', 'campus', 'restricted')),
  faculty_codes jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table databases enable row level security;
create policy "databases_read" on databases for select to authenticated using (is_active = true);

create table researchers (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid unique references patrons(id) on delete cascade,
  full_name text not null,
  orcid_id text unique,
  title text,
  department text,
  faculty_code text,
  bio text,
  research_interests jsonb default '[]',
  google_scholar_url text,
  researchgate_url text,
  total_publications int default 0,
  total_citations int default 0,
  h_index int default 0,
  profile_image text,
  is_public boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table researchers enable row level security;
create policy "researchers_read" on researchers for select to authenticated using (is_public = true or auth.jwt() ->> 'role' = 'admin');

create table researcher_publications (
  id uuid primary key default gen_random_uuid(),
  researcher_id uuid not null references researchers(id) on delete cascade,
  title text not null,
  authors text not null,
  journal text,
  year int,
  volume text,
  issue text,
  pages text,
  doi text,
  url text,
  publication_type text default 'journal',
  citations int default 0,
  created_at timestamptz not null default now()
);
alter table researcher_publications enable row level security;
create policy "pubs_read" on researcher_publications for select to authenticated using (
  exists (select 1 from researchers where researchers.id = researcher_publications.researcher_id and is_public = true)
);

create table webometrics_stats (
  id uuid primary key default gen_random_uuid(),
  metric_type text not null,
  metric_value decimal(12,2) not null,
  rank_global int,
  rank_country int,
  source text,
  recorded_date date not null,
  created_at timestamptz not null default now()
);
alter table webometrics_stats enable row level security;
create policy "webometrics_read" on webometrics_stats for select to authenticated using (true);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null check (event_type in ('academic', 'administrative', 'holiday', 'exam', 'other')),
  start_date date not null,
  end_date date not null,
  is_recurring boolean default false,
  recurrence_pattern text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table calendar_events enable row level security;
create policy "calendar_read" on calendar_events for select to authenticated using (is_active = true);

create table cms_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  content text not null,
  meta_description text,
  is_published boolean default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table cms_pages enable row level security;
create policy "cms_read" on cms_pages for select to authenticated using (is_published = true or auth.jwt() ->> 'role' = 'admin');

create table cms_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  link_url text,
  button_text text,
  position int default 0,
  is_active boolean default true,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table cms_banners enable row level security;
create policy "banners_read" on cms_banners for select to authenticated using (is_active = true);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  priority int default 0,
  category text default 'general',
  is_active boolean default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table announcements enable row level security;
create policy "announcements_read" on announcements for select to authenticated using (is_active = true and (expires_at is null or expires_at > now()));

create table suggestions (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid references patrons(id) on delete set null,
  title text not null,
  author text,
  isbn text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'acquired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table suggestions enable row level security;
create policy "suggestions_own" on suggestions for all to authenticated using (
  patron_id is null or exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = suggestions.patron_id)
);

create table fines (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references patrons(id) on delete cascade,
  amount decimal(10,2) not null,
  reason text not null,
  reference_type text,
  reference_id uuid,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table fines enable row level security;
create policy "fines_own" on fines for select to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = fines.patron_id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references patrons(id) on delete cascade,
  fine_id uuid references fines(id),
  amount decimal(10,2) not null,
  payment_method text not null,
  reference text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table payments enable row level security;
create policy "payments_own" on payments for select to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = payments.patron_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references patrons(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean default false,
  action_url text,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create policy "notifications_own" on notifications for all to authenticated using (
  exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = notifications.patron_id)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table audit_logs enable row level security;
create policy "audit_admin" on audit_logs for select to authenticated using (auth.jwt() ->> 'role' = 'admin');

create table user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_info text,
  ip_address inet,
  last_active timestamptz not null default now(),
  is_current boolean default false,
  created_at timestamptz not null default now()
);
alter table user_sessions enable row level security;
create policy "sessions_own" on user_sessions for all to authenticated using (auth.uid() = user_id);

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  faculty_code text not null,
  hod_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table departments enable row level security;
create policy "departments_read" on departments for select to authenticated using (true);

create table programmes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  department_id uuid not null references departments(id),
  degree_type text not null check (degree_type in ('undergraduate', 'masters', 'doctorate', 'diploma')),
  duration_years decimal(3,1) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table programmes enable row level security;
create policy "programmes_read" on programmes for select to authenticated using (true);

create table app_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy "settings_admin" on app_settings for all to authenticated using (auth.jwt() ->> 'role' = 'admin');

create table migration_history (
  id uuid primary key default gen_random_uuid(),
  batch_name text not null,
  records_processed int not null default 0,
  records_succeeded int not null default 0,
  records_failed int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error_message text
);
alter table migration_history enable row level security;
create policy "migration_admin" on migration_history for all to authenticated using (auth.jwt() ->> 'role' = 'admin');

create index idx_patrons_user_id on patrons(user_id);
create index idx_patrons_email on patrons(email);
create index idx_catalogue_title on catalogue_items using gin(to_tsvector('english', title));
create index idx_catalogue_faculty on catalogue_items(faculty_code);
create index idx_loans_patron on loans(patron_id);
create index idx_loans_status on loans(status);
create index idx_loans_due on loans(due_date);
create index idx_repository_status on repository_items(status);
create index idx_theses_patron on theses(patron_id);
create index idx_theses_status on theses(status);
create index idx_events_start on events(start_at);
create index idx_blog_slug on blog_posts(slug);
create index idx_researchers_orcid on researchers(orcid_id);
create index idx_notifications_patron on notifications(patron_id, is_read);

create table librarians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'faculty_librarian' check (role in ('university_librarian', 'deputy_librarian', 'faculty_librarian', 'assistant_librarian')),
  faculty_code text,
  full_name text not null,
  email text not null,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

drop policy if exists "patrons_select_own" on patrons;
create policy "patrons_select_policy" on patrons for select
  to authenticated
  using (
    auth.uid() = user_id
    or
    exists (select 1 from librarians where user_id = auth.uid() and role in ('university_librarian', 'deputy_librarian') and is_active = true)
    or
    exists (
      select 1 from librarians 
      where user_id = auth.uid() 
        and role = 'faculty_librarian' 
        and is_active = true
        and (librarians.faculty_code is null or librarians.faculty_code = patrons.faculty_code)
    )
  );

drop policy if exists "patrons_update_own" on patrons;
create policy "patrons_update_policy" on patrons for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
  );

create policy "patrons_insert_policy" on patrons for insert
  to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

drop policy if exists "loans_select_own" on loans;
drop policy if exists "loans_insert" on loans;
create policy "loans_select_policy" on loans for select
  to authenticated
  using (
    exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = loans.patron_id)
    or
    exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
  );
create policy "loans_insert_policy" on loans for insert
  to authenticated
  with check (
    exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = loans.patron_id)
    or exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
  );
create policy "loans_update_policy" on loans for update
  to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

drop policy if exists "reservations_own" on reservations;
create policy "reservations_select_policy" on reservations for select
  to authenticated
  using (
    exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = reservations.patron_id)
    or exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
  );
create policy "reservations_update_policy" on reservations for update
  to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

drop policy if exists "ill_own" on ill_requests;
create policy "ill_select_policy" on ill_requests for select
  to authenticated
  using (
    exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = ill_requests.patron_id)
    or exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
  );
create policy "ill_update_policy" on ill_requests for update
  to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

drop policy if exists "fines_own" on fines;
create policy "fines_select_policy" on fines for select
  to authenticated
  using (
    exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = fines.patron_id)
    or exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
  );
create policy "fines_insert_policy" on fines for insert
  to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "fines_update_policy" on fines for update
  to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

alter table librarians enable row level security;
create policy "librarians_select" on librarians for select
  to authenticated
  using (auth.uid() = user_id or exists (select 1 from librarians l where l.user_id = auth.uid() and l.role in ('university_librarian', 'deputy_librarian')));

create index idx_librarians_user_id on librarians(user_id);
create index idx_librarians_faculty_code on librarians(faculty_code);

alter table catalogue_items
  add column if not exists download_count int default 0,
  add column if not exists subjects_text text,
  add column if not exists place_of_publication text,
  add column if not exists series text,
  add column if not exists notes text,
  add column if not exists physical_description text,
  add column if not exists marc21_leader text,
  add column if not exists marc21_fields jsonb default '[]';

create table if not exists catalogue_copies (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references catalogue_items(id) on delete cascade,
  barcode text unique,
  call_number text,
  branch text,
  faculty_code text,
  location text,
  status text not null default 'available'
    check (status in ('available', 'checked_out', 'on_reserve', 'lost', 'damaged', 'processing')),
  due_date date,
  created_at timestamptz not null default now()
);
alter table catalogue_copies enable row level security;
create policy "copies_read" on catalogue_copies for select to authenticated using (true);
create policy "copies_write" on catalogue_copies for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create table if not exists catalogue_discussions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references catalogue_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  patron_name text not null,
  body text not null,
  parent_id uuid references catalogue_discussions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table catalogue_discussions enable row level security;
create policy "discussions_read" on catalogue_discussions for select to authenticated using (true);
create policy "discussions_insert" on catalogue_discussions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "discussions_update" on catalogue_discussions for update to authenticated
  using (auth.uid() = user_id);
create policy "discussions_delete" on catalogue_discussions for delete to authenticated
  using (auth.uid() = user_id);

alter table catalogue_items
  add column if not exists ill_eligible boolean default true;

alter table librarians
  add column if not exists marc21_mode text default 'simple' check (marc21_mode in ('simple', 'advanced'));

create table if not exists z3950_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  query text not null,
  isbn text,
  marc21_data jsonb,
  imported_by uuid references auth.users(id),
  imported_at timestamptz not null default now()
);
alter table z3950_imports enable row level security;
create policy "z3950_write" on z3950_imports for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

drop policy if exists "catalogue_write" on catalogue_items;
create policy "catalogue_write" on catalogue_items for all to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

drop policy if exists "catalogue_read" on catalogue_items;
create policy "catalogue_read_all" on catalogue_items for select using (true);
create policy "catalogue_copies_anon" on catalogue_copies for select using (true);
create policy "discussions_anon_read" on catalogue_discussions for select using (true);

create index if not exists idx_catalogue_items_faculty on catalogue_items(faculty_code);
create index if not exists idx_catalogue_items_format on catalogue_items(format);
create index if not exists idx_catalogue_items_year on catalogue_items(year);
create index if not exists idx_catalogue_copies_item on catalogue_copies(item_id);
create index if not exists idx_catalogue_discussions_item on catalogue_discussions(item_id);

create table if not exists acquisition_suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  contact_name text,
  email        text,
  phone        text,
  address      text,
  country      text not null default 'Nigeria',
  lead_time_days int not null default 14,
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table acquisition_suppliers enable row level security;
create policy "suppliers_read"  on acquisition_suppliers for select to authenticated using (true);
create policy "suppliers_insert" on acquisition_suppliers for insert to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "suppliers_update" on acquisition_suppliers for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "suppliers_delete" on acquisition_suppliers for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create table if not exists purchase_recommendations (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  authors          text,
  isbn             text,
  publisher        text,
  year             int,
  format           text not null default 'Book',
  faculty_code     text,
  urgency          text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'urgent')),
  reason           text,
  status           text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'ordered', 'received')),
  requested_by     uuid references auth.users(id),
  requester_name   text,
  requester_email  text,
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  notes            text,
  catalogue_item_id uuid references catalogue_items(id),
  created_at       timestamptz not null default now()
);
alter table purchase_recommendations enable row level security;
create policy "recs_read" on purchase_recommendations for select to authenticated using (true);
create policy "recs_insert" on purchase_recommendations for insert to authenticated
  with check (auth.uid() = requested_by);
create policy "recs_update_librarian" on purchase_recommendations for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "recs_delete_librarian" on purchase_recommendations for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "recs_insert_public" on purchase_recommendations for insert to anon
  with check (true);

create table if not exists purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  po_number    text not null unique,
  supplier_id  uuid references acquisition_suppliers(id),
  order_date   date not null default current_date,
  expected_date date,
  status       text not null default 'draft'
    check (status in ('draft', 'sent', 'partial', 'received', 'cancelled')),
  faculty_code text,
  notes        text,
  currency     text not null default 'NGN',
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table purchase_orders enable row level security;
create policy "po_read"   on purchase_orders for select to authenticated using (true);
create policy "po_insert" on purchase_orders for insert to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "po_update" on purchase_orders for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "po_delete" on purchase_orders for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create table if not exists purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  po_id              uuid not null references purchase_orders(id) on delete cascade,
  title              text not null,
  authors            text,
  isbn               text,
  format             text not null default 'Book',
  quantity           int not null default 1 check (quantity > 0),
  unit_price         numeric(10,2) not null default 0,
  recommendation_id  uuid references purchase_recommendations(id),
  catalogue_item_id  uuid references catalogue_items(id),
  received_qty       int not null default 0,
  status             text not null default 'ordered'
    check (status in ('ordered', 'partial', 'received', 'cancelled'))
);
alter table purchase_order_items enable row level security;
create policy "poi_read"   on purchase_order_items for select to authenticated using (true);
create policy "poi_insert" on purchase_order_items for insert to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "poi_update" on purchase_order_items for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "poi_delete" on purchase_order_items for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create table if not exists supplier_invoices (
  id             uuid primary key default gen_random_uuid(),
  po_id          uuid references purchase_orders(id),
  invoice_number text not null,
  invoice_date   date not null,
  amount         numeric(12,2) not null,
  currency       text not null default 'NGN',
  payment_date   date,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'partial', 'disputed')),
  notes          text,
  created_at     timestamptz not null default now()
);
alter table supplier_invoices enable row level security;
create policy "inv_read"   on supplier_invoices for select to authenticated using (true);
create policy "inv_insert" on supplier_invoices for insert to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "inv_update" on supplier_invoices for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "inv_delete" on supplier_invoices for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create table if not exists acquisition_budgets (
  id           uuid primary key default gen_random_uuid(),
  faculty_code text not null,
  fiscal_year  text not null,
  total_amount numeric(12,2) not null default 0,
  currency     text not null default 'NGN',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (faculty_code, fiscal_year)
);
alter table acquisition_budgets enable row level security;
create policy "budget_read"   on acquisition_budgets for select to authenticated using (true);
create policy "budget_insert" on acquisition_budgets for insert to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "budget_update" on acquisition_budgets for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "budget_delete" on acquisition_budgets for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create table if not exists serials_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  publisher    text,
  issn         text,
  issn_online  text,
  frequency    text not null default 'monthly'
    check (frequency in ('daily','weekly','fortnightly','monthly','bimonthly',
                         'quarterly','semiannual','annual','irregular')),
  start_date   date,
  renewal_date date,
  cost_per_year numeric(10,2) not null default 0,
  currency     text not null default 'NGN',
  supplier_id  uuid references acquisition_suppliers(id),
  faculty_code text,
  location     text,
  call_number  text,
  status       text not null default 'active'
    check (status in ('active','suspended','cancelled','pending')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table serials_subscriptions enable row level security;
create policy "subs_read"   on serials_subscriptions for select to authenticated using (true);
create policy "subs_insert" on serials_subscriptions for insert to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "subs_update" on serials_subscriptions for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "subs_delete" on serials_subscriptions for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create table if not exists serials_issues (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid not null references serials_subscriptions(id) on delete cascade,
  volume              text,
  issue_number        text not null,
  predicted_date      date,
  actual_arrival_date date,
  status              text not null default 'expected'
    check (status in ('expected','received','missing','claimed','never_published')),
  notes               text,
  claim_sent_at       timestamptz,
  created_at          timestamptz not null default now()
);
alter table serials_issues enable row level security;
create policy "issues_read"   on serials_issues for select to authenticated using (true);
create policy "issues_insert" on serials_issues for insert to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "issues_update" on serials_issues for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "issues_delete" on serials_issues for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create table if not exists serials_routing (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references serials_subscriptions(id) on delete cascade,
  issue_id        uuid references serials_issues(id),
  patron_name     text not null,
  patron_email    text,
  sequence_order  int not null default 1,
  routed_at       timestamptz,
  returned_at     timestamptz,
  created_at      timestamptz not null default now()
);
alter table serials_routing enable row level security;
create policy "routing_read"   on serials_routing for select to authenticated using (true);
create policy "routing_insert" on serials_routing for insert to authenticated
  with check (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "routing_update" on serials_routing for update to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));
create policy "routing_delete" on serials_routing for delete to authenticated
  using (exists (select 1 from librarians where user_id = auth.uid() and is_active = true));

create index if not exists idx_recs_status      on purchase_recommendations(status);
create index if not exists idx_po_status        on purchase_orders(status);
create index if not exists idx_po_faculty       on purchase_orders(faculty_code);
create index if not exists idx_poi_po           on purchase_order_items(po_id);
create index if not exists idx_inv_po           on supplier_invoices(po_id);
create index if not exists idx_budget_faculty   on acquisition_budgets(faculty_code);
create index if not exists idx_subs_status      on serials_subscriptions(status);
create index if not exists idx_subs_renewal     on serials_subscriptions(renewal_date);
create index if not exists idx_issues_sub       on serials_issues(subscription_id);
create index if not exists idx_issues_status    on serials_issues(status);
create index if not exists idx_routing_sub      on serials_routing(subscription_id);