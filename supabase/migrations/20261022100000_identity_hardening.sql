-- T04 (Phase 22): identity hardening.
-- 1) orcid_verified_at records when server-side verification actually happened.
-- 2) Duplicate ORCID claims are backed up and cleared before a unique index is
--    created, so the constraint is reversible and no claim is silently lost.
-- 3) researcher_affiliations + trigger capture institution/department/rank
--    changes on every write path (dashboard saves, admin edits, service writes),
--    giving each public profile an auditable affiliation history.

alter table public.researcher_profiles
  add column if not exists orcid_verified_at timestamptz;

create table if not exists public.orcid_claims_backup (
  backup_id uuid primary key default gen_random_uuid(),
  researcher_id uuid not null references public.researcher_profiles(id) on delete cascade,
  orcid_id text not null,
  cleared_at timestamptz not null default now()
);

with ranked as (
  select id, orcid_id,
         row_number() over (
           partition by orcid_id
           order by created_at asc nulls last, id asc
         ) as rn
    from public.researcher_profiles
   where orcid_id is not null
)
insert into public.orcid_claims_backup (researcher_id, orcid_id)
select r.id, r.orcid_id
  from ranked r
 where r.rn > 1
   and not exists (
     select 1 from public.orcid_claims_backup b where b.researcher_id = r.id
   );

with ranked as (
  select id, orcid_id,
         row_number() over (
           partition by orcid_id
           order by created_at asc nulls last, id asc
         ) as rn
    from public.researcher_profiles
   where orcid_id is not null
)
update public.researcher_profiles rp
   set orcid_id = null, orcid_verified = false, orcid_verified_at = null
  from ranked
 where ranked.id = rp.id and ranked.rn > 1;

create unique index if not exists researcher_profiles_orcid_unique
  on public.researcher_profiles (orcid_id)
  where orcid_id is not null;

create table if not exists public.researcher_affiliations (
  id uuid primary key default gen_random_uuid(),
  researcher_id uuid not null references public.researcher_profiles(id) on delete cascade,
  institution text,
  department text,
  academic_rank text,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  captured_at timestamptz not null default now()
);

create index if not exists idx_researcher_affiliations_researcher
  on public.researcher_affiliations (researcher_id, effective_from desc);

alter table public.researcher_affiliations enable row level security;

drop policy if exists researcher_affiliations_select on public.researcher_affiliations;
create policy researcher_affiliations_select on public.researcher_affiliations
  for select using (
    public.is_library_admin(auth.uid())
    or exists (
      select 1 from public.researcher_profiles rp
       where rp.id = researcher_id
         and (
           (rp.status = 'published' and rp.visibility = 'public')
           or rp.patron_id in (select p.id from public.patrons p where p.user_id = auth.uid())
         )
    )
  );

drop trigger if exists researcher_profiles_affiliation_capture on public.researcher_profiles;

create or replace function public.capture_researcher_affiliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.researcher_affiliations
     set effective_to = now()
   where researcher_id = new.id
     and effective_to is null;

  if not exists (
    select 1 from public.researcher_affiliations where researcher_id = new.id
  ) then
    insert into public.researcher_affiliations (researcher_id, institution, department, academic_rank, effective_from, effective_to)
    values (new.id, old.institution, old.department, old.academic_rank, coalesce(old.created_at, now()), now());
  end if;

  insert into public.researcher_affiliations (researcher_id, institution, department, academic_rank, effective_from)
  values (new.id, new.institution, new.department, new.academic_rank, now());

  return new;
end;
$$;

create trigger researcher_profiles_affiliation_capture
  before update of institution, department, academic_rank
  on public.researcher_profiles
  for each row
  when (
    old.institution is distinct from new.institution
    or old.department is distinct from new.department
    or old.academic_rank is distinct from new.academic_rank
  )
  execute function public.capture_researcher_affiliation();

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'researcher_profiles' and column_name = 'orcid_verified_at';
