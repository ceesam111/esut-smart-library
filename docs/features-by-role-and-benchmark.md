# ESUT Smart Library — Features by Role, and Benchmark vs Koha & DSpace

> **STATUS 2026-10-10 — role model below is still accurate; feature-status claims are not.**
> This document predates batches 8–17 and SLAAS. It still says Z39.50 is simulated, OAI-PMH
> absent, no offline/SIP2, thin notices/reports, single language, mock analytics, no
> preservation/AIP and manual DOIs — all of those were built since. The current, validated
> per-role runbook is **`docs/USER-RUNBOOK.md`**; authoritative status lives in
> `docs/audit/final-platform-capability-reconciliation.md`.

Evidence-based inventory of what each role can actually do in this application, followed by an
honest comparison with two global reference systems: **Koha 26.x** (open-source ILS, 30,000+
installations) and **DSpace 10.x** (open-source research repository, thousands of installations).

Method: everything below was read from the running codebase (role matrices, route guards, sidebar
gates, API route tree, table queries), not from marketing copy. File references are given so each
claim can be checked. Version basis: Koha 26.05 (May 2026), DSpace 10.x (2026) — DSpace-CRIS
merger is in progress upstream, so CRIS-grade features are counted as "DSpace direction", not
shipped everywhere.

---

## 1. The role model (10 roles)

Defined in three places, now aligned (commit `52eb629`):

| Layer | File | Values |
|---|---|---|
| Front end | `src/config/roles.config.ts` (`AppRole`) | 10 roles |
| Server | `src/server/auth/permissions.ts` (`FoundationRole`) | same 10 + unreachable legacy `admin` |
| Database | `public.app_role` enum (migration `20260926140000_app_role_alignment_enum.sql`) | same 10 |

| Role | Label | Dashboard destination | Sidebar scope |
|---|---|---|---|
| `super_admin` | Super Administrator | `/admin` | Everything, incl. Account Management + all role grants |
| `catalog_admin` | Catalog Administrator | `/admin` | Catalog group (`canSeeCatalog`) |
| `ir_admin` | Institutional Repository Administrator | `/admin` | Repository/IR group (`canSeeIr`) |
| `dept_ir_officer` | Department IR Officer | `/admin` | IR queue for own department |
| `librarian` | Librarian | `/admin` | Catalog + IR + Account Management (`isAccountManager`) |
| `faculty_librarian` | Faculty Librarian | `/admin` | Catalog + IR (no account management) |
| `student` | Student | `/dashboard` | Patron area only |
| `researcher_lecturer` | Researcher / Lecturer | `/dashboard` | Patron area + deposit |
| `admin_staff` | Administrative Staff | `/dashboard` | Patron area (same as student) |
| `guest` | Guest (unauthenticated) | public site | Public pages only |

Server-side: every privileged API route resolves roles from `user_roles` and enforces via
`requireRole` / `requireRoles` (`src/server/auth/requireRole.ts`) — 33 of the 56 API routes are
admin-scoped and guarded. Grant/revoke is restricted by `assertCanManageTarget`
(`src/lib/admin-accounts.functions.ts`): only `super_admin` can assign `super_admin`,
`catalog_admin`, `ir_admin`, `dept_ir_officer`.

## 2. Feature matrix (17 product features × 10 roles)

Source: `ROLE_PERMISSIONS` in `src/config/roles.config.ts`.

| Feature | super | catalog | ir | dept_ir | librarian | fac_lib | researcher | student | admin_staff | guest |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `catalogue` (browse/search own catalogue) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `ebooks` (ebook aggregators) | ✔ | ✔ | – | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `lyria` (text-to-speech) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – |
| `subscribedDatabases` (TERAS/EBSCO portal) | ✔ | ✔ | – | – | ✔ | ✔ | ✔ | ✔ | ✔ | – |
| `consortiumDatabases` | ✔ | – | – | – | ✔ | ✔ | ✔ | – | – | – |
| `dashboard` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – |
| `community` / `communityPost` / `newspapers` | ✔ | – | – | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (read only) |
| `aiTools` (AI tools directory + Lexis) | ✔ | – | – | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `repositorySubmit` | ✔ | – | ✔ | ✔ | – | – | ✔ | – | – | – |
| `staffHandbook` | ✔ | – | – | – | ✔ | ✔ | – | – | – | – |
| `cataloguing` (MARC editor, staging, import) | ✔ | ✔ | – | – | ✔ | ✔ | – | – | – | – |
| `irAdmin` (IR queue, publish) | ✔ | – | ✔ | – | ✔ | – | – | – | – | – |
| `irDepartmentCompliance` | ✔ | – | ✔ | ✔ | ✔ | ✔ | – | – | – | – |
| `approvals` (patron + resource approvals) | ✔ | ✔ | ✔ | – | ✔ | ✔ | – | – | – | – |
| `adminPanel` (whole `/admin` area) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | – | – | – |

### 2.1 What each role sees on screen

**Admin side** — `src/components/layout/AdminLayout.tsx`, 36 nav links in 8 groups
(Overview, Patrons, Collections, Academic, Content, Reporting, Consortium, System):

- Entry gate: `roleCan(role, 'adminPanel')` + account approved (line 96) — everyone else gets
  "Admin Access Restricted".
- `canSeeCatalog` (line 71) = super, catalog_admin, librarian, faculty_librarian →
  Catalogue, Catalogue Import, Staging, Adopt, Scan/OCR, Barcodes, Shelves, Authorities,
  Harvest, Catalogue Stats.
- `canSeeIr` (line 72) = super, ir_admin, dept_ir_officer, librarian, faculty_librarian →
  Repository, IR Deposit, Theses, Webometrics.
- `isAccountManager` (line 70) = super, librarian → Account Management (role grants).
- Remaining groups (Patrons, Circulation, Requests, Approvals, Acquisitions, Serials, Databases,
  Consortium, Content, Reporting, System) are visible to all admin-panel roles; individual API
  routes add narrower role checks on top.

**Patron side** — `src/components/layout/DashboardLayout.tsx`: Overview, My Account, Library
Card, My Loans, ILL Requests, Reading Lists, My Thesis, Course Reserves, My Reservations,
Settings, Research Profile; `Supervised Theses` appears only for supervising lecturers.

**Public site** — ~60 routes: catalogue, repository, theses, course reserves, databases
(subscribed + open access), AI tools, AI librarian, newspapers, community/forum, blog, events,
researchers, lecturers, faculty libraries, library branch pages, wellbeing, webometrics, global
search, library manual, book clubs, games/questionnaire, contact, plus static pages.

## 3. Functional inventory (what exists in code today)

| Subsystem | Status | Evidence |
|---|---|---|
| Patron registration + approval workflow | Real | `registration/*` API routes, `patron-approvals/[id]/approve` |
| Circulation (check-out/in, renewals, transactions) | Real | `loans`, `circulation_transactions` writes in `admin/Circulation.tsx` |
| Holds / reservations queue + hold-for-collection + notify | Real | `reservations` status machine, `notifications` insert; RLS fixed in `20260926120000_fix_reservations_staff_rls.sql` |
| Fines | Real | `fines` insert + `admin/Fines.tsx` |
| ILL (resource requests, external source) | Real | `resource-requests`, `resource-requests/external` |
| Barcode lookup / labels / shelf registry | Real | `admin/barcode-lookup`, `Shelves.tsx` |
| Cataloguing: simple + field-by-field **MARC21** editor | Real | `admin/CatalogueNew.tsx` (`buildMarc21`, `marc21_fields` column) |
| MARC binary (`.mrc`) + MARCXML batch import parser | Real | `admin/Migration.tsx` `parseMARCBinary` / `parseMARCXML` |
| Staging + approve/reject before catalogue goes live | Real | `admin/catalogue/staging/[id]/approve` |
| Authorities file (author/subject/series/corporate/geographic) | Basic | `admin/CatalogueAuthorities.tsx`, local terms table |
| "Z39.50 copy cataloguing" | **Simulated** — UI lists Z39.50 targets (British Library, LoC…) but the code actually queries Open Library (`CatalogueNew.tsx:318` "real Z39.50 requires server-side") | `admin/CatalogueNew.tsx` |
| Acquisitions: suppliers, purchase recommendations, POs + items, invoices, budgets | Real | `admin/Acquisitions.tsx` tables `acquisition_suppliers`, `purchase_recommendations`, `purchase_orders`, `purchase_order_items`, `supplier_invoices`, budgets |
| Serials: subscriptions + issue check-in with **predicted dates** | Real | `serials_subscriptions`, `serials_issues` (`predicted_date`) in `admin/Serials.tsx` |
| Course reserves + reading lists | Real | `admin/CourseReserves.tsx`, `dashboard/CourseReserves`, `lecturer/ReadingLists` |
| Repository: deposit, review queue, publish, embargo + license fields | Real | `IrDeposit.tsx` (`embargo_until`, `license`, CC BY default), `repository` API |
| DOI | **Manual entry only** — no minting | `IrDeposit.tsx:117` free-text DOI field; `RepositoryStats` merely counts non-null DOIs |
| Theses portal + supervisor chain | Real | `ThesisSubmit` → `ThesisStatusPublic`, `Supervised Theses` nav |
| Researcher profiles + ORCID | Real | ORCID fields in `ResearcherProfile(s)`, `MyProfile`, `Lecturers` |
| Federated scholarly search (14 open sources) | Real | `search/resources` API + adapters (`adapters.ts`, `sourceRegistry.ts`) — OpenAlex, Crossref, PubMed, DOAJ, HathiTrust, Internet Archive, BASE, CORE, Standard Ebooks, Gutenberg, Open Library, OAPEN, DOAB, Google Books |
| Ebooks / ebook aggregators + Lyria TTS voice | Real | `ebooks` feature, `ai/lyria-voice` API (voice Sarah `EXAVITQu4vr4xnSDxMaL`, unchanged) |
| Subscribed DB portal (TERAS/EBSCO style) + open-access DB directory | Real | `subscribedDatabases.data.ts`, `openAccessDatabases.data.ts` |
| AI librarian chat (Lexis) + AI tools directory | Real | `ai/reference-librarian`, `AITools.tsx` (42 tools / 12 groups), provider router `ai/providers` |
| AI agent workers (scheduled jobs, metrics, templates) | Real infra | `admin/agents/{jobs,schedules,runs,metrics,templates,settings,health}` |
| Content engine / CMS / blog / newsletter / events / media | Real | admin pages + `ContentEngine`, `CMS`, `Blog`, `Newsletter`, `Events`, `Media` |
| Community forum, book clubs, newspapers index | Real | `Feed`, `Forum`, `BookClubs`, `NewspaperIndex` |
| Digital library card with QR + profile photo | Real | `dashboard/LibraryCard`, `ProfilePhotoInput` |
| Study-break / wellbeing tool | Real | `dashboard/Wellbeing` (`Take A Break` extras still open in issues list) |
| B2 cloud storage (signed upload/download) | Real | `admin/storage/b2/{objects,signed-upload,signed-download}` |
| Audit log + role audit | Real | `admin/audit-logs`, role audit page |
| Reports (live DB totals) | Real | `admin/Reports.tsx` queries live counts |
| Catalogue statistics | Real | `admin/CatalogueStats.tsx` aggregates from `catalogue_items` |
| Repository statistics | Real | `RepositoryStats.tsx` counts against Supabase |
| Webometrics initiatives/actions | Partial | tables `webometrics_ranks`, `webometrics_actions` exist but ranks show "Not yet ranked" |
| **Analytics dashboard** | **Mock** — chart series are hard-coded (`const lineData = [...]`) in `admin/Analytics.tsx`; no live data source | gap |
| Turnstile CAPTCHA | **Removed/disabled** (keys belong to another Cloudflare app) | `app/api/security/turnstile/config` returns `siteKey: null` |
| Institution feature toggles | `institutionConfig.features`: thesisPortal ✔, courseReserves ✔, alumniAccess ✔, researcherProfiles ✔, analytics ✔; multiCampus ✘, turnitin ✘, discourse ✘, webometrics ✘ | `src/config/institution.config.ts` |

Scale: 120 page components (47 admin, 13 dashboard, ~60 public), 56 API routes, ~37 tables.

---

## 4. Benchmark vs KOHA (the ILS benchmark)

### 4.1 Where this app is ahead of Koha

| Area | ESUT Smart Library | Koha 26.x |
|---|---|---|
| Conversational AI reference service | Lexis AI librarian chat + 42-tool AI directory + multi-provider router (Gemini/Groq/NVIDIA/Ollama) | None built in; a few community plugins |
| Federated discovery beyond the catalogue | One search box across 14 external open sources + local catalogue + repository + theses | OPAC searches its own catalog (+ optional plugin links) |
| Institutional repository + CRIS-lite | Repository, theses portal, researcher profiles with ORCID, departmental compliance, webometrics module | No IR at all — needs a separate system (usually DSpace) |
| Community/content platform | Blog, newsletter, events, forum, book clubs, newspapers, CMS, staff handbook, library manual, academic-integrity and accessibility pages | Essentially none (OPAC news/list lists only) |
| User experience | React SPA, responsive, QR digital library card, profile photos, inactivity timeout, wellbeing tool | Traditional OPAC/admin, dated but functional |
| Single deployment for library + repository + website | One Next.js + Supabase app | Koha would still need a separate IR and often a separate discovery layer |
| Modern ops niceties | Backblaze B2 signed uploads, audit log, scheduled AI agent workers with metrics | Plugin-based; ops tooling varies |

### 4.2 Where Koha is ahead of this app (real gaps)

| Area | Koha | This app | Gap level |
|---|---|---|---|
| Z39.50/SRU | Genuine Z39.50 **client and server**, SRU | UI exists but proxies Open Library (simulated) | **High** — standard is not actually implemented |
| MARC depth | Full MARC21 + authority control with heading linkage, frameworks/templates, cataloguing plugins, batch record modification, staged imports with overlay/dedupe rules, `.mrc` export | MARC21 editor + `.mrc`/MARCXML import + simple staging + local authorities file | Medium-high |
| Acquisitions maturity | Funds/budgets hierarchy, multiple currencies, vendors with EDI, invoices, claims, EDI ordering, point of sale | Suppliers, recommendations, POs, invoices, basic budgets — no EDI, no POS, single-currency | Medium |
| Circulation robustness | Offline circulation, SIP2/NCIP self-service kiosks, self-check machines, recalls, article requests, transfers with routing, slip/notice printing | Loans, holds, fines, transactions, notifications — no offline/SIP2/print slips | Medium-high |
| Notices & communications | Templated overdue/hold notices by print/email/SMS, batch generate | Email verification + in-app notification rows | Medium |
| Reporting | SQL report writer (write your own), 100+ canned reports, statistics module, calendar | Live counters on Reports page + catalogue/repo stats; **Analytics page is hard-coded demo data** | Medium-high |
| Serials maturity | Claims, receipts, subscription invoices, frequency/irregularity patterns, routing lists | Subscriptions + issue check-in with predicted dates (good start) | Medium |
| Patron management | Guarantors, extended patron attributes, patron cards, bulk modification, statistical categories, per-category circulation rules | Registration + approval, levels/types/faculties, library card, profile editing | Medium |
| Standards & interoperability | EDI, OpenURL, KBART, ERMS licensing, OAI-PMH server, REST API with OAuth2 | REST API routes (internal), no published interop standard | Medium-high |
| Provenance | 20+ years, 30,000+ orgs, migrations from proprietary ILS, i18n, accessibility audits | Single bespoke institution build | Strategic |

**Net vs Koha:** this app matches or exceeds Koha on *digital-facing services* (AI, federated
discovery, IR, community, UX) and is competitive on catalogue/circulation/serials/acquisitions for
a single university, but is clearly below Koha on **standards (real Z39.50/SRU, EDI, SIP2)**,
**reporting depth**, and **operational maturity**.

---

## 5. Benchmark vs DSpace (the repository benchmark)

### 5.1 Where this app is ahead of DSpace

| Area | ESUT Smart Library | DSpace 10.x |
|---|---|---|
| Discovery outside the repository | Federated search over 14 OA sources + local catalogue + e-resources | Searches its own items; external discovery is done by aggregators |
| AI assistance | Built-in AI librarian + AI tools directory | No built-in conversational assistant (experiments/plugins only) |
| Full library services around the repo | Circulation, ILL, course reserves, fines, reservations, patron approval | Pure repository — no circulation at all |
| Public website & engagement | Events, blog, newsletter, forum, newspapers, book clubs, digital card, wellbeing | Repository UI + news/blog plugins |
| Aesthetics & responsiveness | Branded Next.js SPA | DSpace Angular UI — clean but generic |
| Thesis supervision workflow | Deposit → supervisor → status chain with lecturer-facing views | Submission workflows, but no "supervision chain" concept out of the box |
| Ops extras | B2 storage, audit log, scheduled agent workers, live stats pages | Statistics framework, no agent-worker concept |

### 5.2 Where DSpace is ahead of this app (real gaps)

| Area | DSpace | This app | Gap level |
|---|---|---|---|
| **OAI-PMH** | Harvested *and* exposed — this is how Google Scholar/OpenAIRE/aggregators ingest repositories | No OAI-PMH endpoint (the term appears only as a *metric* in Webometrics/RepositoryStats) | **Critical for a repository** |
| **Persistent identifiers** | Mints Handles (and DOI via DataCite integration), ARKs | Own IDs/URLs only; DOI is a **manually typed text field** | High |
| Deposit interoperability | SWORD deposit, COAR Notify direction, OpenAIRE exports | Browser form only | High |
| Versioning & embargoes | Item version chains, per-bitstream embargo/access rights | Item-level `embargo_until` + license only; no version history, no per-file permissions | Medium-high |
| Submission workflow engine | Configurable multi-step workflows, reviewers, decisions, metadata form builder, license acceptance at deposit | One review queue (`repository` approve/reject) with departmental compliance | Medium |
| Preservation | AIPs, checksums, format migration, ARCHIVE bundle | B2 object storage; checksum appears only in storage code | Medium-high |
| Statistics | Per item/collection/community usage, Google Scholar indexing support | `RepositoryStats` counts (items, DOIs, harvest log) — no item-level usage analytics | Medium |
| Full-text discovery | Solr full-text indexing of PDFs | Metadata/keyword search + external APIs (no PDF text extraction found) | Medium-high |
| Multilingual / accessibility | 22+ languages, long-standing a11y work | Single language (English), no audited a11y conformance | Medium |
| Scale & trust | 20+ years, 3,000+ registered instances, LTS/security branches | Bespoke single-institution build | Strategic |

**Net vs DSpace:** this app is a stronger *student-facing service portal* around a repository, but
as a *repository* it is behind on the four things that make a repository citable and harvestable:
**OAI-PMH, minted persistent identifiers, deposit/versioning standards, and preservation**.

---

## 6. Ranked gap list (what to build for parity)

**Critical (defines a repository/library of record):**
1. **OAI-PMH endpoint** for `repository_items` (expose + validate with a registered verb test).
2. **Real Z39.50/SRU** — either a server-side Z39.50 client or honestly rename the current feature
   to "Open Library copy cataloguing" and add SRU (HTTP-based, far easier on this stack).
3. **Persistent identifiers** — Handle or DOI minting instead of manual entry.
4. **Live Analytics page** — replace hard-coded `lineData` with real event counters.

**High:**
5. Authority-file linkage to catalogue records (auto-suggest during cataloguing + "see/see also").
6. Circulation offline mode + printable slips/notices (overdue notice generation).
7. SQL-style report builder or at least a fixed report pack (circulation, stock, ILL, fines).
8. SIP2/self-check or a simplified self-service kiosk API for physical access.
9. Item-level usage statistics + Google Scholar meta tags for repository items.

**Medium:**
10. EDI/multi-currency acquisitions and point of sale (only if the institution needs them).
11. Repository versioning + per-file access control (beyond item-level embargo).
12. Full-text (PDF) indexing for local discovery.
13. Finish Webometrics ranking data (tables exist, values empty).
14. i18n and an accessibility conformance pass.

---

## 7. Caveats (read before quoting this report)

- This is a **code inventory**, not an operational audit: no load test, no security penetration
  test, no accessibility audit, and no proof that every workflow works against the production
  data set. Automated gates do not prove completeness.
- Koha/DSpace comparisons use public documentation of the 2026 releases; plugin ecosystems can add
  individual features on either side.
- Items marked **simulated** (Z39.50) or **mock** (Analytics charts) are honest findings, not
  regressions introduced this session.
- Live verification done this session: production build ✔, 52 unit tests ✔, 18 resource checks ✔,
  tsc at the 64-error baseline ✔, end-to-end 13/13 ✔, app healthy on `virtuallibrary.esut.edu.ng`.
