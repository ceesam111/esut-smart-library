-- Reverts 20261022100000_identity_hardening.sql (Phase 22 / T04).
-- Backed-up duplicate ORCID claims are restored with orcid_verified = false
-- because those claims were never confirmed by server-side verification.

drop trigger if exists researcher_profiles_affiliation_capture on public.researcher_profiles;
drop function if exists public.capture_researcher_affiliation();

drop policy if exists researcher_affiliations_select on public.researcher_affiliations;
drop table if exists public.researcher_affiliations;

drop index if exists researcher_profiles_orcid_unique;

update public.researcher_profiles rp
   set orcid_id = b.orcid_id,
       orcid_verified = false,
       orcid_verified_at = null
  from public.orcid_claims_backup b
 where b.researcher_id = rp.id
   and rp.orcid_id is null;

drop table if exists public.orcid_claims_backup;

alter table public.researcher_profiles drop column if exists orcid_verified_at;
