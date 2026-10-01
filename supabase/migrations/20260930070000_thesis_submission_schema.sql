-- BATCH 7 (A1): make live thesis creation possible.
--
-- The form in src/app-pages/ThesisSubmit.tsx writes faculty/subjects/embargo
-- data that the theses table never had, sends 'Undergraduate Long Essay' (the
-- default submission type) which the check constraint rejects, and the
-- workflow service maps the WITHDRAWN state to a status the check constraint
-- also rejects. Three additive fixes; no constraint is removed or loosened.

alter table public.theses
  add column if not exists faculty text,
  add column if not exists subjects jsonb not null default '[]'::jsonb,
  add column if not exists embargo_enabled boolean not null default false,
  add column if not exists embargo_period_months integer;

alter table public.theses drop constraint if exists theses_submission_type_check;
alter table public.theses add constraint theses_submission_type_check check (submission_type in (
  'thesis', 'dissertation', 'project', 'NCE Long Essay',
  'Final Year Project', 'M.Ed. Dissertation', 'B.Ed. Project',
  'Undergraduate Long Essay'
));

alter table public.theses drop constraint if exists theses_status_check;
alter table public.theses add constraint theses_status_check check (status in (
  'draft', 'submitted', 'supervisor_review', 'returned_to_student',
  'committee_review', 'approved', 'rejected', 'published', 'withdrawn'
));

create index if not exists idx_theses_patron on public.theses(patron_id);
create index if not exists idx_theses_submitter on public.theses(submitter_id);
create index if not exists idx_theses_status on public.theses(status);
