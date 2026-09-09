# Upgrade Readiness Audit

Generated: 2026-06-25

Update 2026-06-26: plain PostgreSQL/Auth replacement recommendations in this audit are superseded by `docs/architecture-direction-update.md`. The active direction is hosted Supabase now and self-hosted Supabase later.

## Scope

This audit covers the deployable Next.js app in `esut-smart-library`. The repository also contains duplicated root-level Supabase migrations and frontend source, but the currently deployable app is the nested Next.js project.

No feature implementation was performed during this audit.

## Current Architecture Summary

- Framework: Next.js `^14.2.35` with the App Router directory `app/`.
- React: `^18.3.1` with `react-dom` `^18.3.1`.
- Routing model: Next.js renders a client-only React SPA through `app/page.tsx`, then `src/App.tsx` uses `react-router-dom` `^6.26.2` and lazy-loaded pages.
- App shell: `app/layout.tsx` defines metadata, global styles, manifest, and fonts; `app/[...slug]/page.tsx` exists for deep-link SPA rendering.
- Server/API routes: no `app/api/**` routes found in the deployable copy.
- Server actions: none found.
- TypeScript: `strict: true`, `moduleResolution: bundler`, `jsx: preserve`, `allowJs: true`, `noEmit: true`, path aliases for `@/*`, `@/pages/*`, and `@config/*`.
- Next config: `output: 'standalone'`, `reactStrictMode: true`, remote images allow any HTTPS hostname, production build ignores ESLint but not TypeScript errors.
- Package manager evidence: both `package-lock.json` and `bun.lock` exist. Because `package-lock.json` is present and scripts are npm-style, use npm unless the team confirms Bun is authoritative.
- Supabase usage: direct browser-side Supabase calls are spread through `src/app-pages/**`, `src/views/**`, `src/components/**`, `src/hooks/**`, and `src/lib/**`.
- Current data access abstraction: thin re-export only in `src/lib/supabase.ts`, backed by `src/integrations/supabase/client.ts`.
- Edge/server functionality: currently implemented as Supabase Edge Functions under `supabase/functions/**`, not as Next.js route handlers or worker code.

## Important Folders

- `app/`: Next.js App Router shell. Contains `layout.tsx`, `page.tsx`, `not-found.tsx`, and catch-all page.
- `src/`: main SPA source.
- `src/App.tsx`: React Router route registry.
- `src/ClientApp.tsx`: client app entry used by Next dynamic import.
- `src/app-pages/`: primary active page components used by the deployed SPA.
- `src/views/`: older/duplicate view components still present and referenced by some imports/search results.
- `src/components/`: shared UI, layout, auth forms, AI widget, repository viewer, dashboard components.
- `src/components/layout/`: `Layout`, `Navbar`, `AdminLayout`, `DashboardLayout`.
- `src/hooks/`: `useAuth`, `useNotifications`, `usePageTitle`, mobile hook.
- `src/lib/`: Supabase wrapper, env helper, registration, email, error handling, admin account functions.
- `src/integrations/supabase/`: generated Supabase browser client and types.
- `config/`: role config and institution config.
- `supabase/functions/`: Edge Functions for AI librarian, ebook search, content harvest, email/push, OAI-PMH, federated search, publication fetch, Zenodo publishing, wellbeing, etc.
- `supabase/migrations/`: SQL migrations for core schema, RLS, roles, repository, circulation, content, reporting, consortium, acquisitions, serials, theses, and audit tables.
- Missing target folders for future architecture: `src/server/**`, `src/features/**`, `app/api/**`, worker entrypoint folder.

## Framework And Routing Findings

- `app/page.tsx` disables SSR for the SPA via `dynamic(() => import('@/ClientApp'), { ssr: false })`.
- `src/App.tsx` owns real application routing with `BrowserRouter`, `Routes`, and `Route`.
- Next.js is currently a deployment/container shell more than a full server-rendered app.
- `@tanstack/react-router` and `@tanstack/react-start` are installed, but the inspected deployed app uses `react-router-dom`.
- There are no Next route handlers for privileged operations such as Supabase service-role auth admin, migrations, S3 signing, or AI proxying.

## Existing Database And Domain Tables

The Supabase migrations define a broad library domain. Important existing tables include:

- Catalogue/resources: `catalogue_items`, `catalogue_copies`, `catalogue_discussions`, `authority_control`, `z3950_imports`, `doab_books_cache`.
- Patrons/users/profiles: `patrons`, `user_roles`, `librarians`, `researcher_profiles`, `researchers`, `researcher_publications`, `researcher_grants`.
- Roles/permissions/audit: `user_roles`, `role_audit_log`, `audit_logs`, `admin_access_log`, `user_sessions`.
- Tenancy/institutions: no normalized `tenants` table found; tenancy is represented by `institution` text, `preferred_branch`, `branch_code`, `faculty_code`, static `institutionConfig`, and consortium tables.
- Consortium/institution network: `consortium_members`, `consortium_databases`, `consortium_access_logs`.
- Loans/circulation: `loans`, `loan_fines`, `fines`, `reservations`, `circulation_transactions`, `ill_requests`, `payments`.
- Repository/theses: `repository_communities`, `repository_collections`, `repository_items`, `theses`, `thesis_reviews`, `thesis_supervisors`, `thesis_workflow`.
- Course reserves/reading lists: `reading_lists`, `reading_list_items`, `course_reserves`, `course_reserve_items`, `course_reading_lists`, `course_reading_list_items`, `reserve_clicks`.
- Content/admin: `blog_posts`, `blog_comments`, `newsletter_issues`, `newsletter_subscribers`, `events`, `event_registrations`, `cms_pages`, `cms_banners`, `cms_menu`, `announcements`, `team_members`.
- Harvest/search/AI-adjacent: `harvest_log`, `content_engine_config`, `integrity_scans`, `feed_events`, `feed_event_reports`.
- Acquisitions/serials: `acquisition_suppliers`, `purchase_recommendations`, `purchase_orders`, `purchase_order_items`, `supplier_invoices`, `acquisition_budgets`, `serials_subscriptions`, `serials_issues`, `serials_routing`.
- Reporting/migration: `report_snapshots`, `migration_logs`, `migration_history`, `webometrics_ranks`, `webometrics_actions`, `webometrics_stats`.

## Storage Buckets And File Usage

- Direct storage usage was found in frontend pages, including `supabase.storage.from('repository')` for uploaded reading-list PDFs and `supabase.storage.from('profile-photos')` for researcher/profile photos.
- Explicit `storage.buckets` creation was not found in the inspected migration grep results, so bucket provisioning may be manual or outside the checked migrations.
- File URLs are stored in domain rows such as `repository_items.file_url`, `course_reading_list_items.pdf_url`, profile photo fields, and cover image fields.
- Future Backblaze migration should introduce a storage service abstraction before changing upload code.

## Existing Feature Overlap

- Catalogue management: admin catalogue list, add item, camera scan, MARC/Z39.50 enrichment, authority control, shelf registry, catalogue stats/adoption.
- Catalogue import/upload: `PatronsImport`, `Migration`, `CatalogueNew`, `CatalogueScan`, and `z3950_imports` exist. CSV parsing appears hand-rolled rather than via `papaparse`.
- Patron import: `src/views/admin/PatronsImport.tsx` and `src/app-pages/admin/PatronsImport.tsx` exist and insert directly into `patrons`.
- Barcode/QR: QR code generation exists via `qrcode` and `qrcode.react`; barcode camera scanning uses browser `BarcodeDetector` in `CatalogueScan`. No `jsbarcode`, `quagga`, or polyfill dependency is installed.
- Lexis AI librarian: implemented through `supabase/functions/ai-librarian/index.ts`, using the Vercel AI Gateway-compatible `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, and model envs.
- Ebook search: implemented through `supabase/functions/ebook-search/index.ts` across Gutenberg, Open Library, OAPEN, DOAB, and Google Books.
- Content harvest: implemented through `supabase/functions/content-harvest/index.ts` against OpenAlex, DOAJ, CORE, Gutenberg, Open Library, OAPEN, DOAB, and writes to `catalogue_items`/`harvest_log`.
- Approval workflows: repository queue, thesis workflow, patron approval/status, account management, acquisition recommendations, and admin approvals pages exist.
- Staging/migration tables: `migration_logs`, `migration_history`, `z3950_imports`, and content harvest logs exist; no dedicated generic `staging_*` import tables found.
- Admin screens: extensive admin route coverage in `src/App.tsx`, including patrons, catalogue, repository, ILL, events, CMS, reports, migration, content engine, analytics, researchers, webometrics, calendar, course reserves, acquisitions, serials, newspaper index, requests, theses, circulation, shelves, consortium, team, and accounts.
- Role checks: `config/roles.config.ts`, `useAuth`, Supabase RPC helpers (`has_role`, `is_super_admin`, `librarian_covers_branch`), and layout-level UI filtering exist.
- RLS policies: many exist, but quality and strictness vary significantly.

## Dependency Readiness

Already installed:

- `zod`
- `sonner`
- `qrcode`
- `qrcode.react`
- `@types/qrcode`
- `@supabase/supabase-js`

Missing or recommended for the planned upgrade path:

- `papaparse` and `@types/papaparse` for robust CSV import parsing.
- `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for Backblaze B2 S3-compatible storage.
- `jsbarcode` for printable barcode generation if required.
- `@ericblade/quagga2` for barcode scanning fallback when `BarcodeDetector` is unavailable.
- `react-dropzone` for safer upload UX.
- Testing stack: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and optionally `@playwright/test`.
- AI client: either `ai` SDK or a small fetch-based Vercel AI Gateway client. Given migration safety and current Edge Function style, start with a minimal fetch-based adapter.

Exact install command:

```bash
npm install papaparse @aws-sdk/client-s3 @aws-sdk/s3-request-presigner jsbarcode @ericblade/quagga2 react-dropzone ai && npm install -D @types/papaparse vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```

If the team chooses not to use Vercel's `ai` SDK, omit `ai` and implement a small `fetch` adapter under `src/server/ai` instead.

## Security Review

- Service-role exposure: no frontend `SUPABASE_SERVICE_ROLE_KEY` usage was found. `src/lib/admin-accounts.functions.ts` explicitly throws for invite/reset flows that require service role, which avoids exposing the key in browser code.
- Browser env risk: `src/lib/env.ts` reads `process.env.SUPABASE_URL` and `process.env.SUPABASE_PUBLISHABLE_KEY` in addition to `NEXT_PUBLIC_*`/`VITE_*`. Because the Supabase client is bundled into the browser, only anon/publishable values should ever be assigned to these names in frontend builds.
- Admin route protection: `AdminLayout` mostly filters nav items and shows/hides super-admin-only links, but it does not block non-admin users from rendering admin routes. Access currently depends on Supabase RLS and per-page failures. Add a real route guard before adding more admin features.
- Dashboard route protection: `DashboardLayout` does not redirect unauthenticated users; pages call Supabase and render based on results. Add an auth-required layout/guard.
- Tenant enforcement: no normalized `tenant_id` enforcement found. Existing scope is branch/faculty/preferred-branch based. This is not enough for future multi-tenant hosting across institutions.
- RLS coverage: RLS exists on many tables, but several policies allow broad authenticated access or `USING (true)`/`WITH CHECK (true)` on sensitive tables such as thesis workflow/supervisors, course reading list items, academic calendar, content engine config, harvest log, and other admin-maintained tables.
- Role model drift: the schema has both `librarians` and `user_roles`, while the frontend primarily uses `user_roles`/`account_role`; older RLS uses `librarians`. Consolidation is needed.
- Public Edge Functions: `supabase/config.toml` disables JWT verification for `doab-books` and `wellbeing-checkin`; other functions rely on default behavior. Functions also use permissive CORS `*`.
- AI gateway: AI functions use Vercel AI Gateway-compatible server-side envs. Keep API keys server-side and route production-affecting AI output through approvals.
- Storage authorization: frontend direct uploads rely on Supabase storage policies; Backblaze migration will require signed upload/download flow or server-mediated object writes.

## Migration-Safe Architecture Plan

Introduce these layers before major feature additions. Keep them thin initially and have them call Supabase internally so behavior remains stable.

- `src/server/db/*`: database adapter interfaces and implementations. Start with `supabaseDb.ts`; later add `postgresDb.ts` using Prisma/Drizzle/Kysely/pg.
- `src/server/auth/*`: current-user resolution, role checks, admin guard, session verification, service-role-only admin flows.
- `src/server/storage/*`: `uploadObject`, `getPublicUrl`, `createSignedUploadUrl`, `deleteObject`. Start with Supabase Storage implementation; later add Backblaze S3 implementation.
- `src/server/ai/*`: Vercel AI Gateway adapter with model config, streaming, rate-limit/error mapping, and audit hooks.
- `src/server/audit/*`: central `writeAuditLog` API for role changes, imports, approvals, AI actions, storage writes, and circulation actions.
- `src/server/jobs/*`: job contract and job runner for content harvest, imports, notifications, level increments, AI enrichment, and cleanup.
- `src/server/tenant/*`: tenant resolver, branch/faculty scope resolver, and future `tenant_id` enforcement helpers.
- `src/features/catalogue/*`: catalogue import, validation, barcode scanning/generation, copy management, metadata enrichment.
- `src/features/patrons/*`: patron import, approval, role assignment, account lifecycle.
- `src/features/barcode/*`: browser scanner, generator, print layouts, fallback scanner.
- `src/features/approvals/*`: generic approval workflow primitives for patrons, repository, theses, acquisitions.

Recommended adapter sequence:

1. Add interfaces and Supabase-backed implementations only.
2. Move new features to interfaces first.
3. Gradually refactor existing direct `supabase.from(...)` calls behind feature services.
4. Add PostgreSQL implementation after schema/migration ownership is clear.

## Database Migration Strategy

- Short term: keep Supabase as the system of record and add abstraction layers around new code.
- Do not point existing frontend directly at Coolify PostgreSQL yet; current auth, RLS, storage, and Edge Functions are Supabase-dependent.
- Normalize schema ownership before migration: convert the current Supabase SQL migrations into a repeatable migration chain for the future Postgres tool.
- Choose one migration tool before Coolify PostgreSQL cutover: Prisma Migrate, Drizzle Kit, or SQL migrations run by a worker. For this app, SQL-first or Drizzle is likely less disruptive because the existing schema is already SQL-heavy and RLS/function-heavy.
- Add a `tenants` table and `tenant_id` columns before true multi-tenant hosting. Backfill current ESUT rows to a default tenant.
- Consolidate role model around `user_roles` and deprecate or bridge `librarians`.
- Replace Supabase Auth last, not first. Auth replacement affects every RLS assumption and user-facing session flow.
- Storage migration should be path-compatible: record provider, bucket, key, public URL, content type, size, checksum, and visibility separately from display URLs.
- Edge Functions should be migrated to either Next route handlers or a worker container one function at a time.

## Recommended Implementation Order

1. Add route guards for dashboard/admin areas without changing business logic.
2. Add `src/server/auth`, `src/server/db`, `src/server/storage`, `src/server/ai`, and `src/server/audit` interfaces with Supabase-backed implementations.
3. Add missing dependencies and test setup.
4. Move new catalogue/patron import features into `src/features/catalogue` and `src/features/patrons` using the adapters.
5. Replace direct storage uploads with `src/server/storage` wrappers while still using Supabase Storage.
6. Add Vercel AI Gateway adapter and migrate `ai-librarian` behavior behind it.
7. Add worker/job contracts under `src/server/jobs`, then move content harvest and scheduled tasks to the worker container.
8. Tighten RLS policies and remove broad `USING true`/`WITH CHECK true` policies from admin tables.
9. Introduce `tenants` and `tenant_id` with backfill and tenant resolver.
10. Start Coolify PostgreSQL parallel migration only after tests, seed/migration replay, and tenant/role policy design are stable.

## Files Likely To Be Changed

- `src/App.tsx`: route guard integration and possibly route grouping.
- `src/components/layout/AdminLayout.tsx`: enforce admin access, not only nav visibility.
- `src/components/layout/DashboardLayout.tsx`: enforce authenticated/approved access.
- `src/hooks/useAuth.ts`: centralize role/tenant/current profile behavior.
- `src/lib/supabase.ts`: keep as compatibility layer while new adapters are added.
- `src/lib/env.ts`: split browser-safe env from server-only env.
- `src/lib/admin-accounts.functions.ts`: replace browser-only admin workflows with Next API routes or server actions.
- `src/app-pages/admin/PatronsImport.tsx`: move CSV parsing/import to `src/features/patrons`.
- `src/app-pages/admin/CatalogueNew.tsx`: move metadata enrichment and inserts to `src/features/catalogue`.
- `src/app-pages/admin/CatalogueScan.tsx`: move scanner/generator logic to `src/features/barcode`.
- `src/app-pages/AILibrarian.tsx` and `src/components/ai/AILibrarianWidget.tsx`: route through AI adapter/API.
- `supabase/functions/ai-librarian/index.ts`: later replaced or mirrored by Next/worker AI endpoint.
- `supabase/functions/content-harvest/index.ts`: future worker job candidate.
- `supabase/migrations/*.sql`: RLS tightening, tenant backfill, role consolidation, storage metadata.
- New: `src/server/db`, `src/server/auth`, `src/server/storage`, `src/server/ai`, `src/server/audit`, `src/server/jobs`, `src/server/tenant`.
- New: `src/features/catalogue`, `src/features/patrons`, `src/features/barcode`, `src/features/approvals`.
- New: `app/api/**` for service-role, AI, signed storage, imports, jobs, and audit endpoints if using Next server runtime.

## Testing Strategy

- Add unit tests for role resolution, route guards, tenant resolver, import validation, barcode parsing, and storage key generation.
- Add integration tests for Supabase adapter methods using mocked Supabase client first; later add a local Postgres test target.
- Add RLS verification scripts that assert student, librarian, faculty librarian, and super admin visibility for core tables.
- Add import tests using malformed CSVs, duplicate patrons, duplicate ISBNs, invalid roles, and large files.
- Add storage tests for accepted MIME types, size limits, path construction, signed URL creation, and deletion.
- Add AI adapter tests for streaming, rate-limit handling, missing key behavior, and prompt boundaries.
- Add Playwright smoke tests for login, catalogue search, admin route denial, patron dashboard, catalogue import preview, and AI librarian.
- Keep `npm run build` as the minimum deployment gate; add `npm run test` and `npm run test:e2e` after tooling is introduced.

## Risk Areas

- The app is a client-rendered SPA inside Next.js, so browser/server boundaries are currently blurry.
- Direct Supabase calls are widely distributed, making a database cutover risky without adapters.
- RLS policies are inconsistent and sometimes permissive.
- Admin routes are not fully route-protected at the React layout level.
- No normalized `tenant_id` means future multi-tenant isolation is not ready.
- Auth migration from Supabase is a large project and should be delayed until data/storage/job abstractions are stable.
- Storage buckets appear to be assumed, not fully migration-provisioned in SQL.
- Two locks (`package-lock.json` and `bun.lock`) can cause dependency drift if both are used.
- Duplicate `src/views` and `src/app-pages` folders increase the chance of editing the wrong implementation.

## Stop Point

This audit is complete. Implementation should wait for approval and a selected first work package.
