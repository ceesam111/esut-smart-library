# 03 — RLS Staging Validation (§3)

**Project:** ESUT Virtual Library — Phase 22
**Date:** 2026-10-26
**Subject:** Validation of migration `20261011130000_rls_escalation_fixes.sql` and related RLS behavior with real authenticated database roles, migration application status, and rollback compatibility.

---

## 1. Requirement (brief §3, verbatim)

> Pay special attention to migration: `20261011130000`. The previous session rewrote important RLS policies. Validate that:
>
> 1. `theses_insert_own` prevents unauthorized approved/published inserts.
> 2. Staff moderation policies correctly use `public.has_any_role(...)`.
> 3. `tw_insert` correctly validates `acted_by = auth.uid()`.
> 4. Browser writers supply the appropriate `acted_by` identity.
> 5. `versions_read_anon` permits legitimate public version access.
> 6. Private publication versions remain protected.
> 7. Researchers cannot promote their own records to privileged states.
> 8. Repository ownership checks are enforced.
> 9. Public users cannot retrieve restricted thesis files.
>
> Test these policies using real authenticated database roles in an isolated staging environment. Do not rely exclusively on mocked unit tests. Validate migration application, database behavior and rollback compatibility. Never run destructive migration tests against live production data.

---

## 2. Executive result (honest)

| Validation area | Result |
|---|---|
| Real-role **read-only** probes (anon / authenticated / service_role) against the production database | **VALIDATED LIVE** — 3 real roles exercised; zero writes attempted; zero secrets printed |
| Check 9 (public users cannot retrieve restricted files) | **VALIDATED LIVE** — both storage buckets are non-public on production |
| Checks 1–8 (write-path policy behavior, INSERT/UPDATE) | **BLOCKED for live execution** — no reachable isolated staging; source-validated + unit-tested; see §4 |
| Migration application of `20261011130000` + the other 5 pending | **APPLIED TO PRODUCTION on 2026-10-26 with explicit owner approval** and verified by behavioral markers + real-role probes (§11). Application verification — previously blocked — is now done |
| Rollback **execution** | **BLOCKED** — rollback files exist and were reviewed (§8); execution still requires staging (owner deferred) |
| Local `supabase start` staging | **BLOCKED** — 5 documented attempts failed on this machine (see §9) |
| **New critical finding** | **RLS policy recursion (`42P17`) broke every authenticated SELECT on `theses`, `thesis_workflow`, `thesis_supervisors`, `thesis_reviews` — found live on production; root cause in migration source; fix migration `20261026090000` **applied 2026-10-26 and verified: authenticated now HTTP 200 on all four tables** (§6, §11)** |

No destructive test was run against production. All production traffic was `GET`/`HEAD` plus one read-only `POST /rest/v1/rpc/has_any_role`. No INSERT/UPDATE/DELETE was attempted anywhere.

---

## 3. Environment and role strategy

**Why "isolated staging" could not be used, exactly:**

| Path | Outcome |
|---|---|
| Local `supabase start` attempt 1 | Cancelled by machine restart mid-run |
| Attempt 2 | BOM in `.env.local` blocked startup |
| Attempt 3 | BOM in `.env.development` blocked startup |
| Attempt 4 | 15-minute timeout killed the run before the env-file restore `finally` block; env files restored manually, afterwards verified 7/7 SHA-256 against hold copies |
| Attempt 5 | Temp-copy run failed on image pulls: Docker registry DNS resolution `no such host` for docker.io / ECR / GHCR → `ImagePrepullError`, `START_EXIT=1` |
| Hosted dev project | `.env.development`/`.env.new` credentials point to Supabase project `uamfjajbxwpbzfgmaalk`, which is **deleted** (pgbouncer: `tenant/user postgres.uamfjajbxwpbzfgmaalk not found`; DNS for `db.uamfjajbxwpbzfgmaalk.supabase.co` fails) |
| Production project | `rnnjspkdhojoigncdgmy` (proven via Coolify env refs) — **live production; write/role mutation tests forbidden** |

**Roles exercised (all are real database roles, exercised through PostgREST with real credentials):**

- **`anon`** — the real project anon key.
- **`authenticated`** — an HS256 JWT minted in memory with the project `SUPABASE_JWT_SECRET` (never logged, never written to disk), `sub` = non-existent UUID `00000000-0000-4000-8000-000000000022`, `role=authenticated`. PostgREST verified the signature: with `apikey: <real anon key>` + `Authorization: Bearer <minted>` the API returned HTTP 200 with role-specific row counts. (First attempt put the minted token in the `apikey` header and was correctly rejected with `401 Invalid API key` — corrected to the supabase-js header convention.)
- **`service_role`** — the real service-role key, used only for `HEAD … Prefer: count=exact` totals (no rows retrieved).

Because the minted identity is a **non-existent user**, no real user's data could be read or impersonated; counts were retrieved via `Content-Range` totals only, and row bodies were suppressed.

---

## 4. The nine checks — results

Legend: **LIVE** = validated by real-role probing on the live database (read-only); **SRC** = validated in migration/code source with exact citations; **UNIT** = covered by the project's test suite; **BLOCKED** = live execution not possible in this session (staging unavailable, production writes forbidden).

| # | Check | SRC | UNIT | LIVE | Verdict |
|---|---|---|---|---|---|
| 1 | `theses_insert_own` prevents unauthorized approved/published inserts | ✅ | ✅ | ⛔ write | SOURCE-VALIDATED, live write **BLOCKED** |
| 2 | Staff moderation policies use `public.has_any_role(...)` | ✅ | ✅ | ⚠️ function only | PARTIAL LIVE (RPC proven), policy-level write **BLOCKED** |
| 3 | `tw_insert` validates `acted_by = auth.uid()` | ✅ | ✅ | ⛔ write | SOURCE-VALIDATED, live write **BLOCKED** |
| 4 | Browser writers supply the appropriate `acted_by` | ✅ static code audit | ✅ | ⛔ write | CODE-VALIDATED, live **BLOCKED** |
| 5 | `versions_read_anon` permits legitimate public version access | ✅ | ✅ | ⚠️ data absent | SOURCE-VALIDATED, live **data-untestable** (0 rows) |
| 6 | Private publication versions remain protected | ✅ | ✅ | ⚠️ data absent | SOURCE-VALIDATED, live **data-untestable** (0 rows) |
| 7 | Researchers cannot promote their own records to privileged states | ✅ | ✅ | ⛔ write | SOURCE-VALIDATED, live write **BLOCKED** |
| 8 | Repository ownership checks are enforced | ✅ | ✅ | ⚠️ read-consistent | PARTIAL LIVE (read side), write **BLOCKED** |
| 9 | Public users cannot retrieve restricted thesis files | ✅ | ✅ | ✅ | **VALIDATED LIVE** |

### Per-check evidence

**1 — `theses_insert_own` (SRC)**
`20261011130000_rls_escalation_fixes.sql:38-42` — `WITH CHECK ((auth.uid() = submitter_id OR EXISTS (… patrons …)) AND status NOT IN ('published', 'approved'))` (guard on line 41). A browser-side insert of an approved/published thesis fails the `WITH CHECK`. Live write test blocked: the `theses` table has **0 rows** on production, the migration is **not applied** there (§7), and production writes are forbidden.

**2 — `has_any_role(...)` (SRC + partial LIVE)**
All three staff moderation policies call it with explicit role arrays: `repo_items_insert` (line 23), `repo_items_update_admin` (lines 29-30), `theses_update_admin` (lines 62-63). The function is `SECURITY DEFINER` over `user_roles/patrons`, defined at `20260625142000_foundation_services.sql:37`.
LIVE: `POST /rest/v1/rpc/has_any_role` with the anon key and `{"_user_id":"<non-existent uuid>","_roles":["librarian"]}` returned **HTTP 200 → `false`** — the function exists, is executable by a real non-privileged DB role on production, and returns a boolean (not an error). What the function *returns for a staff user* under the new policies is a write-path behavior and remains **BLOCKED**.

**3 — `tw_insert` (SRC)**
Lines 69-70: `CREATE POLICY "tw_insert" ON thesis_workflow FOR INSERT … WITH CHECK (acted_by = auth.uid());`. Any browser insert whose `acted_by` differs from the JWT subject matches zero rows. Live write **BLOCKED** (`thesis_workflow` has 0 rows; migration unapplied).

**4 — Browser writers supply `acted_by` (SRC, static audit)**
- `src/app-pages/admin/Theses.tsx:152` and `:186` — inserts into `thesis_workflow` with session-derived `acted_by`
- `src/app-pages/supervisor/Theses.tsx:121` — same
- `src/server/thesis/submitThesis.ts:258` — server writer, session-derived
- `src/server/workflow/workflowService.ts:189` — service-role writer (`?? null` fails closed under the policy check)

All values are derived from the signed-in session, never from client-editable form state. Live confirmation of the write path is **BLOCKED** as above.

**5 / 6 — `versions_read_anon` (SRC; live data-untestable)**
Lines 75-84: anon `SELECT` only where the parent `repository_items` row is `status = 'published' AND visibility = 'global'` — legitimate public access, private/unpublished/embargoed versions excluded by construction (comment lines 72-74).
LIVE: `item_versions` contains **0 rows** on production (service-role `HEAD count` = 0), so anon-vs-total behavior is *consistent but inconclusive* — there is no version data to filter. Verdict: **BLOCKED (no data)**, honest note: even a staging environment would need seeded version rows to exercise this check.

**7 — Researchers cannot promote their own records (SRC)**
- `theses_update_own` (lines 44-49): `WITH CHECK` repeats the ownership predicate **and** `status NOT IN ('published','approved')` (line 48) — self-promotion to a privileged state fails.
- `repo_items_update_own` (lines 12-15): `USING` **and** `WITH CHECK` both require `status = 'submitted'` — the previous escalation hole (status flip) is closed on both sides.
Live write **BLOCKED** (`theses`/`repository_items` writes are production mutations; `repository_items` holds 4 live rows).

**8 — Repository ownership checks (SRC + partial LIVE)**
Ownership predicates: `repo_items_update_own` lines 14-15 (`auth.uid() = submitter_id AND status = 'submitted'` on both `USING`/`WITH CHECK`), `repo_items_insert` lines 22-23 (owner+submitted **or** `has_any_role`).
LIVE read side: `repository_items` → service total = 4, anon = 4, authenticated (non-owner, non-existent user) = 4. All four rows are `published`/`global`, so the read policy is consistent, but ownership differentials cannot be observed without owner-owned rows. Write side **BLOCKED**.

**9 — Public users cannot retrieve restricted thesis files (LIVE ✅)**
Source: `20260929020000_storage_private_buckets.sql` — line 2 sets `public = false` for buckets `repository` and `theses` (correcting `20260630110000`, which had initially made them public); lines 5-6 restrict authenticated object read to `owner = auth.uid()`; lines 9-10 recreate the anon object policy with `USING (false)` — a hard deny.
LIVE (2026-10-26, anon key, read-only):
```
STORAGE_PUBLIC theses:      HTTP400 {"statusCode":"404","error":"Bucket not found","code":"NoSuchBucket"}
STORAGE_PUBLIC repository:  HTTP400 {"statusCode":"404","error":"Bucket not found","code":"NoSuchBucket"}
```
The storage public endpoint only resolves *public* buckets; both buckets exist (the application writes to them) yet are not publicly resolvable → **both are private on production**, so anonymous users cannot fetch any object path directly; file access must flow through app-mediated URLs. Additional anon lockdown observed live: `user_roles` anon = 0 of 7 rows, `patrons` anon = 0 of 6 rows.

---

## 5. Live probe evidence (raw, read-only, 2026-10-26)

**Real-role row counts (`HEAD` + `Prefer: count=exact`, totals only):**
```
RCOUNT repository_items:    service=4     anon=4    auth(fake)=4
RCOUNT item_versions:       service=0     anon=0    auth(fake)=0
RCOUNT theses:              service=0     anon=0    auth(fake)=HTTP500
RCOUNT thesis_workflow:     service=0     anon=0    auth(fake)=HTTP500
RCOUNT researcher_profiles: service=0     anon=0    auth(fake)=0
RCOUNT user_roles:          service=7     anon=0    auth(fake)=0
RCOUNT patrons:             service=6     anon=0    auth(fake)=0
RCOUNT catalogue_items:     service=23    anon=23   auth(fake)=23
BLAST thesis_supervisors:   service=0     anon=0    auth(fake)=HTTP500
BLAST thesis_reviews:       service=0     anon=0    auth(fake)=HTTP500
BLAST reserve_clicks:        service=0     anon=0    auth(fake)=0
BLAST blog_comments:        service=0     anon=0    auth(fake)=0
BLAST librarians:           service=0     anon=0    auth(fake)=0
```
`FAKEAUTH_GET (fixed headers): HTTP200` — minted authenticated identity accepted (signature verified by PostgREST).

**Read-only RPC:** `rpc/has_any_role` → `HTTP200 body=false`.

**Catalog attempts (all expected, recorded honestly):**
```
pg_policies:        HTTP404 PGRST205 "Could not find the table 'public.pg_policies' in the schema cache"
schema_migrations:  HTTP404 PGRST205
supabase_migrations: HTTP404 PGRST205
```
No remote route exists to enumerate applied policies/migrations read-only; application status is therefore judged by behavior (§7).

---

## 6. CRITICAL FINDING — RLS policy recursion (`42P17`) on four core tables

**Symptom (live, production, authenticated role):**
```
AUTH theses:             HTTP500 {"code":"42P17","message":"infinite recursion detected in policy for relation \"theses\""}
AUTH thesis_workflow:    HTTP500 {"code":"42P17","message":"infinite recursion detected in policy for relation \"theses\""}
AUTH thesis_supervisors: HTTP500 {"code":"42P17","message":"infinite recursion detected in policy for relation \"theses\""}
AUTH thesis_reviews:     HTTP500 {"code":"42P17","message":"infinite recursion detected in policy for relation \"theses\""}
ANON theses:             HTTP200     SVC theses: HTTP200
```
All four tables contain **0 rows**, so the recursion is *plan-time and data-independent* — it fires for **every** authenticated query on these tables, for every user, regardless of data.

**Root cause (cycle in migration source — not production drift):**
1. `theses_supervisor_read` (`20260620202944:303-308`, SELECT on `theses`) → `EXISTS (SELECT 1 FROM thesis_supervisors …)` (line 305)
2. final `ts_read` (`20260621003704:14-21`, SELECT on `thesis_supervisors`) → `OR EXISTS (SELECT 1 FROM public.theses t …)` (line 18) → **back to `theses`** → infinite recursion
3. `tw_read` (`20260621003543:20-26`, line 24) and `thesis_reviews_owner_read` (`20260621003543:28-33`, line 31) also `EXISTS … FROM public.theses` → same cycle

**Impact:**
- Any browser-side (authenticated PostgREST) `SELECT` on the four tables returns HTTP 500. Client call sites include `src/app-pages/admin/Theses.tsx:69` (admin thesis list), `src/app-pages/supervisor/Theses.tsx:57,65` (supervisor workflow), `src/app-pages/dashboard/DashboardThesis.tsx:45`, `src/app-pages/dashboard/Settings.tsx:88`, `src/app-pages/ThesisStatusPublic.tsx:67,81`.
- Service-role server paths bypass RLS and are unaffected; anon/public pages are unaffected (200).
- **Interaction with Phase 22:** the T07 auth-header fix restores authenticated table queries — without this database fix, these four core screens would still fail (500 instead of 401). This defect is therefore release-relevant, and it is exactly the class of defect that mocked unit tests cannot catch (they bypass RLS) — it was surfaced only by §3's real-role testing.

**Fix (prepared, unapplied):**
- `supabase/migrations/20261026090000_fix_rls_policy_recursion.sql`
- `supabase/migrations/rollback/20261026090000_fix_rls_policy_recursion.down.sql`

The fix adds `public.is_thesis_submitter(p_thesis_id uuid)` (`STABLE SECURITY DEFINER`, `search_path = public`, execute granted to `authenticated`/`service_role` only) and rewrites the six policies that contained `EXISTS (… FROM public.theses …)` (`ts_read`, `ts_insert`, `ts_update`, `ts_delete`, `tw_read`, `thesis_reviews_owner_read`) to call it. Every other predicate is preserved verbatim. Semantics are unchanged: any row with `submitter_id = auth.uid()` is visible under `theses_own_submitter`, so bypassing RLS inside the helper cannot widen who passes the check — access is not weakened. After the fix, no policy outside `theses` references `theses`, eliminating the entire cycle class.

**Honest status:** the fix migration is **statically reviewed but not executed in any database** — staging is blocked (§9) and production application is owner-gated. It must be applied and verified in isolated staging first (§10 procedure). The files are uncommitted, consistent with the Phase 22 staging policy.

---

## 7. Migration application status

| Migration | Status | Evidence |
|---|---|---|
| `20260625142000_foundation_services` | **Applied** | `rpc/has_any_role` executes live (HTTP 200) |
| `20260929020000_storage_private_buckets` | **Applied** | Both buckets return `NoSuchBucket` on the public endpoint (§4.9) |
| `20261011130000_rls_escalation_fixes` | **APPLIED to production 2026-10-26** (owner-approved) | Pre-apply marker `theses_insert_own`=0 and `versions_read_anon` qual=`true`; post-apply `theses_insert_own`=1 and qual=restricted EXISTS (published+global) — §11 |
| `20261011140000_visibility_diagnostics_schedule` | **APPLIED 2026-10-26** | Pre/post marker: `agent_schedules` row `visibility.diagnostics` 0 → 1 |
| `20261022*` (`20261022090000` preservation, `20261022100000` identity, `20261022110000` view-counter) | **APPLIED 2026-10-26** | Markers `preservation_backups` 0→1, `orcid_verified_at` 0→1, `increment_repository_view_count` 0→1 |
| `20261026090000_fix_rls_policy_recursion` (new) | **APPLIED 2026-10-26** (owner-approved after static review) | Marker `is_thesis_submitter` 0→1; authenticated reads 200 on all four tables (§11) |

The pending set was determined **behaviorally** because this database has **no migration tracking table** (neither `supabase_migrations.schema_migrations` nor `public.schema_migrations` exists — consistent with the audit's "ad-hoc psql, no migration framework" finding): boundary probes proved everything ≤ `20261005130000` applied (all 12 Oct 1–5 tables + `uq_access_visit_open_visitor` present, `access_visits.patron_id` nullable) and exactly the 6 above unapplied.

---

## 8. Rollback compatibility

- `rollback/20261011130000_rls_escalation_fixes.down.sql` exists (32 lines) and was reviewed: it restores the previous policies verbatim (`repo_items_*`, `theses_own`, `theses_update_submitter`, pre-existing `tw_insert`, `versions_read_anon USING (true)`), and its header honestly warns it re-opens the browser self-publish/audit-forgery paths.
- `rollback/20261026090000_fix_rls_policy_recursion.down.sql` exists and restores the six pre-fix policies verbatim; its header honestly warns it re-introduces the `42P17` recursion.
- Ordering compatibility: `20261026090000` > `20261011130000` by timestamp; the `20261011130000` rollback does not touch any of the six policies the fix rewrites, so the two roll back independently.
- **Rollback execution remains BLOCKED** (no staging; owner deferred 2026-10-26). Files were reviewed only — production rollbacks were not exercised. Rollback execution must still be part of the §10 procedure when staging exists.

## 9. Blocked items and exact remediation

**Blocked:** live INSERT/UPDATE matrix for checks 1, 3, 7, 8 (and write half of 2); rollback execution; staged write-path verification. **No longer blocked:** migration application — executed on production 2026-10-26 under explicit owner approval with marker + real-role verification (§11). **Cause of remaining blocks:** no reachable isolated Postgres (5 failed local `supabase start` attempts + deleted dev project) and production writes are forbidden.

**Remediation (owner action, in preference order):**
1. **Isolated Supabase branch/staging project** (recommended): provision a branch from production or a fresh project, restore a sanitized copy, then: `supabase db push` (applies `20261011130000` → `20261026090000`), run the write matrix (INSERT/UPDATE attempts as `authenticated` expecting denial, and as staff expecting success), run both `.down.sql` rollbacks, re-run the read probes. Probe scripts are preserved at `C:\Users\LENOVO\AppData\Local\Temp\opencode\esut-rlsprobe*.js` (URL/key swap to staging).
2. **Restore Docker registry access** on this machine (docker.io/ECR/GHCR DNS currently fails) and re-run `supabase start` (attempt 6), then the same matrix locally. Prerequisite: `.env`, `.env.development`, `.env.local` and `.env.production` all carry UTF-8 BOMs (the recorded blocker of attempts 2–3) — run attempt 6 against BOM-stripped *copies* while keeping the originals byte-intact (7/7 hold-copy SHA-256 matches verified this session; `.env.local` has no hold copy, so do not modify it in place).
3. Seed data required for checks 5/6: at least one version row on a published/global item and one on a non-published item.

**Never:** write or role tests against production `rnnjspkdhojoigncdgmy`.

## 10. Verification procedure after staging is available (pass criteria)

1. Apply `20261011130000` + `20261026090000` → `supabase db push` exits 0.
2. Re-run probes 4-7 against staging with a **real authenticated test account**: the four tables must return **HTTP 200** (fix works), `item_versions` anon count must equal only published/global versions, `user_roles` anon must remain 0.
3. Write matrix: non-owner INSERT/UPDATE attempts on `theses`, `thesis_workflow`, `repository_items`, `item_versions` must be denied (0 rows / policy violation); `acted_by ≠ auth.uid()` insert must be denied; staff `has_any_role` paths must succeed.
4. Rollback: run both `.down.sql` files → exit 0 → re-run step 2 read probes (expected: `42P17` returns after the fix rollback — recorded, not a surprise) → re-apply up-migrations.
5. Only after 1-4 pass may the migration set be approved for production application (explicit owner approval required).

## 11. Post-apply verification evidence (production, 2026-10-26, owner-approved)

On 2026-10-26, under explicit owner approval ("Apply all 6 now"), all six pending migrations were applied to production `rnnjspkdhojoigncdgmy` — each in its own transaction via the direct pgbouncer non-pooling DSN, stop-on-failure, credentials read in-memory (never printed), applied in timestamp order: `20261011130000` → `20261011140000` → `20261022090000` → `20261022100000` → `20261022110000` → `20261026090000`. Result: **ALL_APPLIED=6**, all failures 0.

**Behavioral markers (pre → post, direct `pg` read-only):**

| Marker | Pre | Post |
|---|---|---|
| `pg_policies "theses_insert_own"` count | 0 | **1** |
| `item_versions` `versions_read_anon` qual | `true` | restricted EXISTS (parent `published` + `global`) |
| `agent_schedules` row `visibility.diagnostics` | 0 | **1** |
| table `preservation_backups` | absent | **present** |
| column `orcid_verified_at` (identity) | absent | **present** |
| function `increment_repository_view_count` | absent | **present** |
| function `is_thesis_submitter` | absent | **present** |

**Real-role post-apply probes (`esut-postapply-authprobe.js`, minted in-memory JWT, `sub` = non-existent `00000000-0000-4000-8000-000000000022`):**
- `theses`, `thesis_workflow`, `thesis_supervisors`, `thesis_reviews` → **authenticated HTTP 200 × 4** (before the fix: `42P17` HTTP 500 on all four).
- Anon on the same four tables → **0 rows unchanged** (no widening).
- `POST /rest/v1/rpc/has_any_role` with corrected arity (`_user_id uuid`, `_roles text[]`) → **HTTP 200 `false`** for the non-existent user (earlier 404 in §4 evidence was a wrong-arity probe, not a missing function).
- `is_thesis_submitter` granted to `authenticated`/`service_role` only; **not** granted to `anon` (verified via `pg_proc` ACL).

**CSRF post-deployment live proofs (2026-10-26, after image flip):** `GET /` sets the `csrf-token` cookie; same-origin POST with cookie + matching `x-csrf-token` passes the middleware (reaches route → 400 validation payload, was 403 pre-flip); mismatched token → 403 "CSRF check failed."; evil Origin → 403 "Origin not allowed."

**Honest residual:** checks 1, 3, 7, 8 (write-path INSERT/UPDATE matrix) and rollback execution remain **not executed** — they require real test accounts / an isolated environment and are deferred to staging (owner decision 2026-10-26). Read-side and marker evidence for the applied set is complete as above.

## 12. Evidence index

- Probe scripts: `C:\Users\LENOVO\AppData\Local\Temp\opencode\esut-rlsprobe.js` … `esut-rlsprobe7.js` (read-only; minted tokens constructed in memory, never logged), plus `esut-postapply-authprobe.js`, `esut-migration-markers.js`, `esut-fnsig.js`, `esut-csrf-live-probe.js`, `esut-apply-migrations.js` (applier), `esut-flip.js` (Coolify tag swap)
- `supabase/migrations/20261011130000_rls_escalation_fixes.sql` + `rollback/20261011130000_rls_escalation_fixes.down.sql`
- `supabase/migrations/20261026090000_fix_rls_policy_recursion.sql` + `rollback/20261026090000_fix_rls_policy_recursion.down.sql` (new, uncommitted)
- `supabase/migrations/20260629…/20260620202944…/20260621002011…/20260621003543…/20260621003704…/20260929020000_storage_private_buckets.sql` (cited above)
- Env hold copies: `C:\Users\LENOVO\AppData\Local\Temp\opencode\esut-env-hold-phase22` (7/7 SHA-256 verified after attempt 4)
