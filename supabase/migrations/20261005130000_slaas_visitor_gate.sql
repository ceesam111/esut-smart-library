-- SLAAS visitor gate support: visits may belong to a visitor instead of a patron.
-- Patron visits keep access_identity_id/patron_id; visitor visits set visitor_id
-- (+ visitor_pass_id) and leave patron fields null.

alter table public.access_visits
  alter column access_identity_id drop not null,
  alter column patron_id drop not null;

-- Invariant: at most one open visit per visitor.
create unique index if not exists uq_access_visit_open_visitor
  on public.access_visits (visitor_id)
  where status = 'checked_in' and visitor_id is not null;

create index if not exists idx_access_visits_visitor
  on public.access_visits (visitor_id, checked_in_at);
