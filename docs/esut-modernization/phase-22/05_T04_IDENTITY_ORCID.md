# 05 — T04: Researcher Identity and ORCID (Phase 22, §4)

## What existed and what was inspected

T04 already had partial infrastructure from earlier in the phase (per `15_INDEPENDENT_REAUDIT` and the working tree). Rather than creating a parallel implementation, the existing one was inspected and completed:

| Component | Location | Status |
|---|---|---|
| Identity server logic | `src/server/identity/` (+ tests) | exists, suite-green |
| Client identity helpers | `src/lib/identity/` (incl. `validateOrcidId`) | exists, used by `RepositorySubmit.tsx` |
| Admin identity API | `app/api/admin/identity/` | exists |
| Profile API | `app/api/profile/` | exists |
| Hardening migration | `supabase/migrations/20261022100000_identity_hardening.sql` + rollback `rollback/20261022100000_identity_hardening.down.sql` | created earlier this phase, **not applied to production** (owner-gated) |

## Gap-list coverage (§4 items)

| Required capability | Evidence |
|---|---|
| Researcher identity validation | identity server module + tests (in 115-file/1003-test green run) |
| Author name variants / disambiguation | identity module handles name-based matching; duplicate-name scenarios covered by its tests |
| Faculty & department affiliation / historical affiliation | affiliation fields on researcher identity records; profile API exposes them |
| Publication–author relationships | repository/thesis records carry structured authors (`authorsJson` with optional ORCID on submit) |
| Duplicate researcher detection | identity tests cover duplicate-name scenarios (§4 requirement) |
| Researcher profile completeness | profile API + admin identity routes |
| ORCID support | format validation on submission (`validateOrcidId` rejects malformed IDs rather than storing them) |
| ORCID OAuth linking | **not implemented — see below** |

## ORCID OAuth linking — deliberately not fabricated

§4 says "where feasible, implement approved ORCID OAuth linking. Do not fabricate ORCID verification or ownership."

- Feasibility check: OAuth linking requires registering an application with ORCID (client ID/secret, redirect URI on `virtuallibrary.esut.edu.ng`) — an institutional registration with an external provider. No credentials exist in the workspace, and the phase forbids new third-party integrations without clear need/approval and forbids fabricating verification.
- **Decision: not implemented; recorded as a standing institutional dependency** (also listed in 04 and the 13 checklist). The existing ORCID *format validation* and *display* remain intact; nothing claims "verified ORCID" anywhere.

## This session's related fix (identity-adjacent)

`RepositorySubmit.tsx` called `/api/identifiers/mint` (route enforces `requireUser`) **without** an Authorization header → DOI/handle minting silently failed on every submission. Fixed with the repo's `authHeaders()` pattern (2 call sites). This directly serves §4's identity/publication-relationship integrity: deposited records now actually receive their identifiers when minting is enabled.

## Resolved problems

- Silent identifier-mint failure on submit (above).
- No duplicate ORCID implementation created; existing implementation reused per instruction.

## Remaining issues / unverified

- ORCID OAuth linking: BLOCKED on institutional registration (owner action).
- Migration `20261022100000`: reviewed with rollback present; **application to production not performed** (owner-gated).
- Live duplicate-researcher behavior against production data: unverified (no write access; production has no researcher-profile rows seeded for testing).

## Verification results

- Full suite after all changes: 115 files / 1003 tests passed, exit 0 (identity + identity tests included).
- `tsc --noEmit` exit 0; ESLint exit 0 on changed files; `next build` exit 0.
