# 13 — Deployment & Rollback Plan (ESUT Virtual Library)

## 1. Current production topology

| Item | Value | Evidence |
| --- | --- | --- |
| Public URL | https://virtuallibrary.esut.edu.ng | Runbook, live check 2026-10-11 |
| Runtime | Coolify-managed Docker container on the owner VPS | Runbook `ESUT_Smart_Library_Complete_Platform_Runbook.docx`, commit `44854c1` |
| Active container | `dgbxbva96eayp8ktfc3guqi0` on image `ghcr.io/ceesam111/esut-smart-library:20261020-2101` (commit `c1f4394`) | Coolify API `status=running:healthy`, live checks 2026-10-21 |
| Previous (rollback) image | `ghcr.io/ceesam111/esut-smart-library:20261011-1146` (commit `44854c1`), untouched on GHCR | Coolify API history |
| Rollback container | `esut-app-new`, kept **stopped** | Runbook |
| Image registry | GitHub Container Registry. The **application** image is `build_pack=dockerimage`: built from the repo working tree with `NEXT_PUBLIC_*` build args, pushed to GHCR, and referenced by a pinned tag in Coolify. A GitHub push alone does **not** deploy. | Coolify API `docker_registry_image_name`/`docker_registry_image_tag`, 2026-10-21 |
| Known-bad image | `:20261020-2042` — built **without** the `NEXT_PUBLIC_*` build args (throws `Missing Supabase environment variable(s)` in browsers). Left unreferenced; never deploy it. | Build log 2026-10-21, inline-gate rerun |
| Database | Supabase (managed Postgres + Auth + Storage) | — |

## 2. Release procedure for this modernization pass

1. **Gates (all executed on this pass):** `tsc --noEmit`, `eslint . --max-warnings=0`, `vitest run --maxWorkers=2`, `next build` — results in `12_AUTOMATED_TEST_RESULTS.md`.
2. **Commit & push:** only intended source/docs/migrations are staged. Untracked report/prompt/scratch files are never staged. Pushing alone does **not** change production.
3. **Application image build:** `docker build` from the repo working tree with the six `NEXT_PUBLIC_*` values supplied as build args from `.env.local` (browser-visible by design; server secrets never passed), tagged `ghcr.io/ceesam111/esut-smart-library:<date-time>`.
4. **Inline gate:** start the freshly built image and confirm the Supabase host appears in `.next/static` chunks (count > 0). Do not push or deploy if it fails — a missing value produces a site that throws in every browser.
5. **Push & flip:** `docker push` the tag, `PATCH /api/v1/applications/dgbxbva96eayp8ktfc3guqi0` with `{"docker_registry_image_tag": "<new-tag>"}`, then `POST .../start` and poll `GET /api/v1/deployments/<uuid>` until `finished`.
6. **Smoke verification:** `/` (200), `/api/health` (200), `/robots.txt`, `/sitemap.xml`, `/repository-sitemap.xml`, `/api/oai?verb=Identify`, a known public record page (meta tags), `/api/theses`, and `public/google34e078cbadc624f4.html` (exact Google verification line — a Google re-check 404s ownership if it disappears).
7. **CI** continues to build the worker + sip2 images (pipeline run 38122415650 pattern); the application image is not CI-built.

## 3. Database migrations — approval-gated

Two migrations were written in this pass and are **deliberately NOT applied** by the engineering process:

| Migration | Purpose | Rollback |
| --- | --- | --- |
| `supabase/migrations/20261011130000_rls_escalation_fixes.sql` | Closes self-publish escalation (`WITH CHECK` on repository + theses inserts/updates), constrains `thesis_workflow` inserts to the acting user (`acted_by = auth.uid()`), scopes anon `item_versions` reads to published/global items, and adds staff moderation UPDATE policies gated on `public.has_any_role` (the Supabase JWT `role` claim is `authenticated` for browser sessions and can never carry an application role) | `supabase/migrations/rollback/20261011130000_rls_escalation_fixes.down.sql` (restores the predecessor policies verbatim as last set by `20260620202651`, `20260620202944`, `20260621002011`) |
| `supabase/migrations/20261011140000_visibility_diagnostics_schedule.sql` | Seeds the daily `visibility.diagnostics` worker schedule (idempotent, `where not exists`) | Delete the schedule row |

**Apply order:** run the RLS migration first during low traffic, verify with `anon` + `authenticated` probes (anon must read only published/global items; submitter UPDATE to `published` must be rejected), then apply the schedule seed. Roll back with the `.down.sql` file if probes regress. Application code is compatible with both pre- and post-migration states (the worker job tolerates a missing schedule; the API never depends on anon read of `theses`).

## 4. Rollback plan (application)

1. Roll back the application by pointing Coolify at the previous tag: `PATCH /api/v1/applications/dgbxbva96eayp8ktfc3guqi0` with `{"docker_registry_image_tag": "20261011-1146"}`, then `POST .../start` (or, in the Coolify UI, set the image tag to `ghcr.io/ceesam111/esut-smart-library:20261011-1146` and redeploy). Starting the retained `esut-app-new` container remains the secondary fallback.
2. No data rollback is required for this pass: all code changes are backwards-compatible with the existing schema (they read existing columns only; the only schema additions are the two pending migrations).
3. If the RLS migration misbehaves, apply the `.down.sql` rollback — it restores the previous policies verbatim.

## 5. Secrets & configuration

- Secrets enter through Coolify environment configuration and Supabase secrets; **no secret values are stored in the repository or printed in logs** (credential file `new-coolify-credentials.txt` under `Projects/OURSCHOOL/` is referenced by the runbook only and is never copied into this project).
- `NEXT_PUBLIC_APP_URL` drives canonical URLs, robots and sitemaps (`appBaseUrl()`); misconfiguration shows up immediately as wrong absolute URLs and is checked in smoke verification.
- Known owner-side follow-ups (from earlier deployment work): GitHub PAT rotation in the origin remote URL, Resend DNS verification, optional provider keys — tracked in `14_INSTITUTIONAL_DEPENDENCIES.md`.
