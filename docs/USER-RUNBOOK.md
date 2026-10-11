# ESUT Smart Library — Complete Platform Runbook (All User Roles)

Purpose: tell **every user level** exactly what features they have, how to use them effectively,
what the **system administrator** must do and watch, and which **human/external actions** (API keys,
DNS, policies, hardware) remain outside the code.

Validation basis: re-read from the running codebase on **2026-10-10** at commit `124248a`
(health `GET /api/health` = 200, gates: tsc 0, lint 0/0, vitest 766/766, 15 live E2E suites
554/554). Every claim below points at the file that enforces it. Where the older
`docs/features-by-role-and-benchmark.md` is stale, this runbook supersedes it (see §15).

---

## 1. Shared foundation (applies to everyone)

### 1.1 The 10 roles

Defined in three aligned layers (`src/config/roles.config.ts`, `src/server/auth/permissions.ts`,
DB enum `public.app_role`):

| Role | Label | Home after login | Admin panel |
|---|---|---|---|
| `super_admin` | Super Administrator | `/admin` | Yes — full, incl. Account Management |
| `catalog_admin` | Catalog Administrator | `/admin` | Yes — catalogue group + approvals + SLAAS |
| `ir_admin` | Institutional Repository Administrator | `/admin` | Yes — repository group + approvals |
| `dept_ir_officer` | Department IR Officer | `/admin` | Yes — own-department IR queue + compliance |
| `librarian` | Librarian | `/admin` | Yes — everything incl. Account Management + SLAAS |
| `faculty_librarian` | Faculty Librarian | `/admin` | Yes — catalogue + IR + approvals + SLAAS |
| `student` | Student | `/dashboard` | No |
| `researcher_lecturer` | Researcher / Lecturer | `/dashboard` | No (deposit rights instead) |
| `admin_staff` | Administrative Staff | `/dashboard` | No |
| `guest` | Guest (not signed in) | public site | No |

Roles are stored in `user_roles` (privileged staff roles) or `patrons.account_role`
(patron roles only) — `PRIVILEGED_ROLES` in `permissions.ts` forces privileged roles to
come from `user_roles` only.

### 1.1b Feature matrix — everything a role is granted (`ROLE_PERMISSIONS`)

✓ = feature enabled for that role (enforced by `roleCan()` in nav + page guards):

| Feature | super | catalog | ir | dept | librarian | fac_lib | researcher | student | admin_staff | guest |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Browse/search catalogue | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ebooks | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lyria text-to-speech | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Subscribed databases (TERAS/EBSCO portal) | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Consortium databases | ✓ | – | – | – | ✓ | ✓ | ✓ | – | – | – |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Community / forum / newspapers | ✓ | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | read |
| AI tools + AI librarian | ✓ | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Repository submit (deposit) | ✓ | – | ✓ | ✓ | – | – | ✓ | – | – | – |
| Staff handbook | ✓ | – | – | – | ✓ | ✓ | – | – | – | – |
| Cataloguing (MARC, staging, import) | ✓ | ✓ | – | – | ✓ | ✓ | – | – | – | – |
| IR admin (queue/publish) | ✓ | – | ✓ | – | ✓ | – | – | – | – | – |
| IR department compliance | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | – | – | – |
| Approvals (non-patron types) | ✓ | ✓ | ✓ | – | ✓ | ✓ | – | – | – | – |
| Admin panel (`/admin`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – |

Additions on top of this matrix that are **not** Feature flags: SLAAS group =
`LIBRARY_ADMIN_ROLES` (super, librarian, faculty_librarian, catalog_admin); SLAAS
branches/exports/analytics = `GLOBAL_ADMIN_ROLES` (super, librarian); Account Management =
super + librarian; supervisor thesis views = supervising lecturers; patron area = everyone
signed in with a patron role.

### 1.2 Getting an account

1. **Register** at `/register` (institutional email + password + profile fields).
2. **Admin approval**: a `super_admin` or `librarian` opens `/admin/approvals` and approves the
   pending account (patron-approval API reads require `GLOBAL_ADMIN_ROLES` — see
   `canReadApprovalItem` in `permissions.ts`).
3. **Sign in** at `/login` (email + password; `supabase.auth.signInWithPassword`). Email
   verification never locks a user out — the password is proven first
   (`src/app-pages/Login.tsx`).
4. **Forgot/reset password**: `/forgot-password` → `/reset-password`.
5. Staff roles are granted later in **Account Management** (`/admin/accounts`) — only
   `super_admin` may grant `super_admin`, `catalog_admin`, `ir_admin`, `dept_ir_officer`
   (`ADMIN_GRANT_ONLY_ROLES`). A `librarian` can manage patron-facing accounts but cannot
   create peer administrators or target super admins (`src/lib/admin-accounts.functions.ts`).
6. **First Super Admin** (fresh environment):
   `npm.cmd run bootstrap:super-admin -- --email=you@esut.edu.ng --level=ceo --name="Full Name"`
   (needs `SUPABASE_SERVICE_ROLE_KEY`; levels: `ceo` | `aceo`).

### 1.3 Things every signed-in user should know

- **Language**: EN/FR switcher in the header (all UI strings pass through `t()`).
- **Library card**: `/dashboard/library-card` — QR code + photo; the QR is your SLAAS
  identity at the gate and your borrow token at circulation.
- **Notifications**: in-app bell (notifications table) + email (Resend primary, Gmail SMTP
  fallback — `src/server/email/providers/`).
- **Admin area timeout**: the admin panel auto-signs out after **30 minutes of inactivity**
  (`INACTIVITY_MS` in `AdminLayout.tsx`) — save long work often.
- **Access restrictions are enforced server-side**: every privileged API route calls
  `requireRole(...)`; hiding a menu item is never the only protection.

---

## 2. Guest (not signed in) — the public site

**Entry**: any public URL, no login. 142 routes exist; the guest-visible surface:

| Area | What you can do | Where |
|---|---|---|
| Catalogue | Browse, keyword search, view item records, availability | `/catalogue`, `/catalog/:id`, `/search/global` |
| Federated discovery | One query across 14 open scholarly sources (OpenAlex, Crossref, PubMed, DOAJ, Internet Archive, HathiTrust, BASE, CORE, Google Books via edge functions, etc.) | `/search/global` (server route `search/resources`) |
| Repository | Browse published items, download where access allows | `/repository`, `/repository/:id` |
| Theses | Browse thesis titles/status lookup by reference | `/theses`, `/thesis/status` |
| Course reserves | See what a course has reserved | `/course-reserves` |
| E-resources | Ebook aggregators, subscribed-DB portal (title/URL level), open-access directory | `/databases`, `/subscribed-databases`, `/open-access-databases` |
| AI | AI Librarian chat (Lexis), AI tools directory (42 tools) | `/ai-librarian`, `/ai-tools` |
| Community (read) | Newspapers index + articles, forum (read), blog, events, feed, book clubs | `/newspapers`, `/forum`, `/blog`, `/events`, `/feed`, `/book-clubs` |
| People & places | Researchers, lecturers, faculty libraries, branch pages | `/researchers`, `/lecturers`, `/faculty-libraries`, `/library/:slug` |
| Info | FAQ, manual, contact, privacy, terms, accessibility, academic integrity, tutorial, webometrics, wellbeing | `/*` static pages |
| SEO | Sitemaps | `/catalog-sitemap.xml`, `/repository-sitemap.xml` |

**Guests cannot**: borrow/renew, post to the forum, submit a repository item, reserve a book,
see patron data, or open any `/admin/*` or `/dashboard/*` page (they are redirected to `/login`).
Anonymous spam on sensitive forms is protected by the custom rate limiter in `middleware.ts`
(Arcjet sits in front only if `ARCJET_KEY` is configured — currently not, see §14).

**How to use effectively**: start at `/search/global` — it searches the local catalogue,
repository and 14 external sources in one box; use `/catalogue` for pure OPAC browsing with
facets.

---

## 3. Student

**Home**: `/dashboard`. **Sidebar (13 links)** — `DashboardLayout.tsx`:

| Item | Route | What to do there |
|---|---|---|
| Overview | `/dashboard` | Loans count, **outstanding fines total** (live from `fines` table), requests, quick stats |
| My Account | `/dashboard/account` | Profile, status, contact details |
| Library Card | `/dashboard/library-card` | Show QR at the gate/issue desk; profile photo |
| **My Access** (SLAAS) | `/dashboard/access` | Your gate visit history (entry/exit, branch, method) — read-only, self-scoped via `/api/access/me` |
| My Loans | `/dashboard/loans` | Current loans, due dates, renewals |
| ILL Requests | `/dashboard/ill` | Ask the library to obtain something not in stock (internal + external ILL) |
| Reading Lists | `/dashboard/reading-lists` | Lists your lecturers published |
| My Thesis | `/dashboard/thesis` | Submit and track thesis (postgraduate; thesis portal on) |
| My Submissions | `/dashboard/workflows` | Track workflow items you submitted (e.g. repository/other submissions) |
| Course Reserves | `/dashboard/course-reserves` | What your courses placed on reserve |
| My Reservations | `/dashboard/requests` | Holds the library placed **for you** (staff-created at the circulation desk) + their queue status |
| Settings | `/dashboard/settings` | Password, preferences, language |
| Research Profile | `/dashboard/lecturer-profile` | **Hidden for students** (lecturers only) |

**Typical student workflow**
1. Search `/catalogue` → open an item → if everything is on loan, either **ask the desk to
   place a hold** (holds are created by staff from Admin → Circulation — there is no
   self-service hold button yet) or file an **ILL request** for something the library does
   not own → track both under `/dashboard/requests` and `/dashboard/ill`.
2. Borrow physically: present your **Library Card QR** at the desk; the loan appears under
   **My Loans** with due date; **renew yourself** from My Loans up to the renewal limit set
   in circulation rules.
3. Missing something? **ILL Requests** → track status; the librarian sees it at
   `/admin/ill`.
4. Fines appear as an **outstanding-fines total** on the Overview card; pay/settle at the desk
   (staff record the payment in Admin → Circulation → Fines).
5. Entering the library: the officer scans your QR at the gate → your visits show in
   **My Access**. Spot a wrong entry? Ask the desk to raise a **correction** (officers have a
   corrections queue).
6. Thesis (PG): `/dashboard/thesis` → submit → supervisor reviews → status visible to you and
   publicly at `/thesis/status`.

**Limits**: no catalogue editing, no approvals, no posting without moderation rights, no
admin panel (you get "Admin Access Restricted" at `/admin`).

---

## 4. Administrative Staff (`admin_staff`)

Identical permissions to **Student** (same `ROLE_PERMISSIONS` entry): full patron area,
no deposit rights beyond patron thesis if applicable, no admin panel. Use §3 as-is.

---

## 5. Researcher / Lecturer (`researcher_lecturer`)

Everything in §3 **plus**:

| Extra feature | Route | Notes |
|---|---|---|
| Repository deposit | `/repository/submit`, `/admin`-free deposit form | Your submissions land in the IR review queue |
| Thesis supervision views | `/supervisor/theses` (sidebar appears only when you supervise) | Approve/reject/annotate student theses |
| Reading-list management | `/lecturer/reading-lists` | Publish lists students see |
| Research profile + ORCID | `/dashboard/lecturer-profile` | Name, ranks, ORCID iD, publications — feeds `/lecturers` and `/researchers` public pages |
| Consortium databases | feature `consortiumDatabases` | Consortium group visible to you on the public site |
| Course-reserve requests | via course reserves area | Ask staff to place items on reserve |

Deposit tips: fill embargo date and licence at deposit (CC BY is default), use the workflows
page (`/dashboard/workflows`) to see reviewer decisions; DOIs are minted only if a Zenodo
token is configured (§14), otherwise the repository's own ID is used.

---

## 6. Faculty Librarian (`faculty_librarian`)

**Admin panel** (`/admin`) — sidebar = everything except:
- **Account Management** (account managers = `super_admin` + `librarian` only),
- nothing else is hidden: you see catalogue module, IR module, SLAAS group.

| Area | What you can do |
|---|---|
| Catalogue module (`canSeeCatalog`) | Browse/add/edit items, MARC editor, CSV + MARC import, staging approve/reject, adopt-from-union, camera scan, barcodes, shelves, authorities, stats (linked pages) |
| IR module (`canSeeIr`) | Review queue `/admin/repository`, deposit on behalf, theses, webometrics (route present; nav hidden while `institutionConfig.features.webometrics = false`) |
| Approvals | **Non-patron** approvals; patron approvals API requires `GLOBAL_ADMIN_ROLES` (super/librarian) — you will be denied on patron-type items by design |
| Circulation | Desk check-out/in, fines, holds processing |
| SLAAS | Scan station, manual ops, visitors, branches read, visits log (see §12 for what needs super/librarian) |
| Content, reporting, consortium, system (minus accounts) | Blog/newsletter/events/CMS, reports, migration tools, preservation, agents |

**Limits**: cannot grant roles at all; cannot configure SLAAS branches/export/analytics
(`GLOBAL_ADMIN_ROLES`); cannot manage accounts.

---

## 7. Librarian (`librarian`)

Everything a Faculty Librarian has, **plus**:

- **Account Management** (`/admin/accounts`): create/approve/suspend patrons and staff,
  grant patron-facing roles, view the **audit log** (audit view lives inside Account
  Management — there is no separate audit route), review approval queues for patron types.
- **SLAAS global operations**: branch configuration, visit logs, exports, analytics,
  occupancy (`GLOBAL_ADMIN_ROLES` — see §12).
- Can grant roles **below** the administrator-only set (`super_admin`, `catalog_admin`,
  `ir_admin`, `dept_ir_officer` are Super-Admin-only); never targets a super admin.

This is the default "power operator" account for day-to-day library operations.

---

## 8. Catalog Administrator (`catalog_admin`)

**Sees**: catalogue module (full), approvals (non-patron types), SLAAS scan/manual/visitors,
plus the shared groups (patrons, circulation, content, reporting, consortium, system-minus-
accounts, overview).

**Does not see**: IR module links (`canSeeIr` false), Account Management, SLAAS branches/
exports/analytics (needs `GLOBAL_ADMIN_ROLES`), patron-type approvals (API-level).

Focus: MARC quality, imports/staging, barcodes, shelf registry, catalogue statistics.

---

## 9. IR Administrator (`ir_admin`)

**Sees**: IR module (review queue, deposit, theses, webometrics route), compliance
(`irDepartmentCompliance`), approvals (non-patron), workflows, researchers, content,
reporting, circulation — shared groups.

**Does not see**: catalogue module links (`canSeeCatalog` false), SLAAS group (not in
`LIBRARY_ADMIN_ROLES`), Account Management.

Focus: approve/reject repository deposits, embargo/licence correctness, departmental
compliance reporting, researcher profiles, workflow decisions.

---

## 10. Department IR Officer (`dept_ir_officer`)

**Sees**: your **own department's** IR queue + compliance pages, deposit, shared groups
minus catalogue module, minus SLAAS, minus approvals (feature not granted) and minus
Account Management.

Focus: clear your department's submissions, enforce faculty/department metadata compliance.
Departmental scoping is enforced in the repository APIs + RLS, not just in the UI.

---

## 11. Super Administrator (`super_admin`)

Everything visible: all 51 admin sidebar links across 10 groups (Overview, Patrons,
Collections, Academic, Content, Reporting, Consortium, Circulation, **SLAAS**, System) plus
every secondary page (fines, theses, communities, CMS menu, harvest, authorities, batch
modify, MARC import, catalogue stats, repository stats — reached from within pages).

Unique Super-Admin duties:
1. **Grant/remove** the administrator-only roles; set `super_admin_level` (`ceo`/`aceo`);
   ACEO cannot manage CEO-level or grant `super_admin` (`admin-accounts.functions.ts`).
2. Approve **all** pending accounts (patron approvals are GLOBAL_ADMIN-scoped).
3. Configure **SLAAS branches**, review exports/analytics/occupancy.
4. Read **audit logs** (Account Management) and act on anomalies.
5. Own environment/keys/backup policy (§13–§14).

---

## 12. SLAAS access-control operating guide (Smart Library Access & Analytics System)

**Who operates it**: any role in `LIBRARY_ADMIN_ROLES` = `super_admin`, `librarian`,
`faculty_librarian`, `catalog_admin` (+ legacy `admin`). The sidebar group `SLAAS` appears
only for them (`roles:` filter in `AdminLayout.tsx`). `ir_admin`/`dept_ir_officer` do **not**
get it; patrons see only their personal history.

| Page | Route | API guard | What the operator does |
|---|---|---|---|
| Access dashboard | `/admin/access` | `GLOBAL_ADMIN_ROLES` for analytics | Live occupancy, visits/day, entry-method split |
| **Scan station** | `/admin/access/scanner` | `LIBRARY_ADMIN_ROLES` | Camera/QR scan of library-card QR → instant admit/deny (valid card, expiry, blocklist); QR visitor passes |
| Manual ops | (scanner page manual mode) | `LIBRARY_ADMIN_ROLES` | Type patron number when QR won't read; record entry/exit manually |
| Visitors | `/admin/access/visitors` | `LIBRARY_ADMIN_ROLES` | Walk-in visitors: identity record, pass issue (QR), blocklist |
| Branches | `/admin/access/branches` | `GLOBAL_ADMIN_ROLES` | Create/configure branches, gate devices, open hours |
| Visit log | `/admin/access/visits` | `LIBRARY_ADMIN_ROLES` (read), GLOBAL for exports | Search/filter visits; corrections queue (patron dispute → officer records a reasoned amendment — `server/slaas/corrections.ts`) |
| Export / analytics / occupancy | via dashboard | `GLOBAL_ADMIN_ROLES` | CSV export for reporting, occupancy view |

**Patron side**: `/dashboard/access` shows the person's own visits only.

**External hardware mode**: a tablet/phone at the gate can run the offline circulation
kiosk at `/offline` (queues scans locally, syncs when online — backlog visible to staff at
`/admin/offline-sync`). SIP2 self-service kiosks are managed at `/admin/sip2-terminals`
(terminals + credentials + heartbeat; listener: `npm.cmd run sip2`).

**Operating discipline**: scans write cross-tenant scoped rows (enforced + red-teamed
2026-10-10); corrections are audit-logged; never share one officer session across gates —
one login per gate device.

---

## 13. System administrator runbook

### 13.1 Start / stop map

| Service | Command (Windows) | Notes |
|---|---|---|
| Web app (dev) | `npm.cmd run dev` | Next dev on :3000 |
| Web app (prod) | `npm.cmd run build` then `npm.cmd run start` | Build rewrites `.next` — stop the server first |
| Background worker | `npm.cmd run worker` | Queue: extraction, notices, reports, preservation, search index, communications (`worker/handlers/*`); health on `WORKER_HEALTH_PORT` |
| SIP2 listener | `npm.cmd run sip2` | Self-service kiosks; Docker option: `Dockerfile.sip2` |
| All-in-one | `docker-compose.yml` (app), `Dockerfile.worker`, `Dockerfile.sip2` | Container path for servers |

Useful scripts: `seed:demo`, `seed:demo:verify`, `bootstrap:super-admin`,
`scan:secrets`, `scan:sast`, `test:coverage`. Backups: `scripts/backup.sh`,
`scripts/restore.sh`, DR rehearsal `scripts/backup-restore-slaas-live.mjs`.

### 13.2 First-time setup (order matters)

1. Copy `.env.example` → `.env.local`, fill values (§14 tells you which are still empty).
2. Apply DB migrations (supabase) + `python DWC-CORE/dwc.py doctor` at workspace level.
3. `npm.cmd run bootstrap:super-admin` (first super admin).
4. Create SLAAS **branches** at `/admin/access/branches` (GLOBAL_ADMIN) before first scans.
5. Start worker + SIP2 if those services are in scope; verify `/api/health` = 200.
6. Verify outbound email once (self-test notice) — Resend domain must be verified first (§14).

### 13.3 Daily checks (5 minutes)

| Check | How | Healthy looks like |
|---|---|---|
| App health | `GET /api/health` | HTTP 200 |
| Worker alive | health port (`WORKER_HEALTH_PORT`) or host process list | responding |
| Queue backlog | `/admin/agents` → jobs/runs/metrics | no growing failure pile-up |
| Notices | `/admin/notices/delivery` | no sustained bounce/failure rows |
| Offline sync backlog | `/admin/offline-sync` | offline transactions draining |
| SIP2 terminals | `/admin/sip2-terminals` | heartbeats current; no `SYNC_IN_PROGRESS` storms |
| SLAAS occupancy/anomalies | `/admin/access` | occupancy within thresholds; scan failures investigated |
| Security inbox | audit view in `/admin/accounts` | unexpected role grants / login anomalies |

### 13.4 Weekly / monthly

- **Backup verification**: confirm B2 backup bucket growth; run
  `scripts/backup-restore-slaas-live.mjs` rehearsal (last result: restore verified in ~42 s).
- **Gates before any release**: `typecheck`, `lint`, `test` (766), `scan:secrets`,
  `scan:sast`, `npm audit --omit=dev` — all also enforced in `.github/workflows/ci.yml`.
- **Fixity/preservation**: `/admin/preservation` (cadence `PRESERVATION_CADENCE_DAYS`,
  default built in) — resolve failed checksums.
- **DR/walkthrough of red-team watchlist** (§7 of `final-independent-red-team-audit.md`):
  memory/disk growth, AI provider breaker state, backup freshness, a11y spot-check,
  analytics tokens (currently UI-only controls), OAI base URL once public, NCIP/egress rules,
  DOI prefix ownership, webometrics cadence.
- **Licences/subscriptions**: TERAS/EBSCO & consortium links, domain/certificate expiry,
  Resend quota, Supabase project quotas, B2 bucket costs.
- **Upgrade path**: `npm audit`, Next/security advisories, then rebuild + re-run the 15
  live E2E suites (commands in `docs/audit/slaas-quality-gates.md`).

### 13.5 Subsystem-specific watchpoints

- **AI**: router order `AI_PROVIDER_ORDER` (default in code), breaker
  `AI_PROVIDER_BREAKER_*`; `GEMINI_API_KEY`/`GROQ_API_KEY` are set; `AI_GATEWAY_API_KEY`
  empty → gateway/OmniRoute path inactive (§14). Agent metrics at `/admin/agents/metrics`.
- **Email**: Resend primary (`RESEND_API_KEY`, from `esut.edu.ng` / `esutlibrary.edu.ng`
  domains), Gmail SMTP fallback (`GMAIL_SMTP_*`).
- **Storage**: three B2 buckets (library files, backups, exports) via signed URLs
  (`admin/storage/b2/*`); watch quota + failed uploads.
- **Federated search**: edge functions use `Deno.env` secrets — CORE/NCBI/Google
  Books/Semantic Scholar keys optional; missing keys degrade those sources silently.
- **Rate limiting**: custom limiter in `middleware.ts` (`RATE_LIMIT_SENSITIVE_*`,
  `APP_BASE_URL`, `CORS_ALLOWED_ORIGINS`); Arcjet inactive until `ARCJET_KEY` is set.
- **CAPTCHA**: Turnstile endpoint intentionally returns `siteKey: null` today (off).

### 13.6 Incident playbooks (things that actually happened in testing)

| Symptom | Cause seen in test | Fix |
|---|---|---|
| SIP2 process dies with ECONNRESET | kiosk drops TLS socket | current code has a persistent socket error handler (batch15 F-07); if it recurs, check listener logs |
| `tsx` SIP2 "already listening" | orphan listener from a crashed run | kill the orphan `sip2/index.ts` process (matched by cmdline), then restart |
| Offline sync rejects with `SYNC_IN_PROGRESS` | **two** sync workers running (duplicate process) | ensure a single worker/runner; purge stale `[E2E]`/test fixtures if present |
| Email never arrives | Resend domain unverified / key absent | §14 item 1 — verify domain DNS, then send test notice |
| Search sources silently missing | optional API key empty | expected degradation; add key (§14) |
| AI answers fail | provider key/limit/breaker open | check `/admin/agents` metrics; provider order/breaker envs |

### 13.7 Security & compliance ops

- Never commit `.env*` (gitignored); rotate any credential that ever appears in output or
  config (see §15 finding about the GitHub token).
- CI blocks: `scan-secrets` (1,002 patterns) and `sast-scan` (10 baselined deps) run on push.
- Review role grants quarterly (audit view), run an external pentest before go-live (P2
  residual), keep the DPIA current for staff data in SLAAS (`docs/privacy/slaas-dpia-technical-input.md`).
- Accessibility: automated a11y E2E (20 checks) is green; an external conformance review is
  still an open human action.

---

## 14. Human actions & external dependencies (what the code cannot do alone)

Status verified against `.env.local` on 2026-10-10 (**SET** = value present; secrets are
never printed by DWC).

### 14.1 Must-do to unblock real operation

| # | Action | Where | Current status | Effect when done |
|---|---|---|---|---|
| 1 | **Verify sending domains** `esut.edu.ng` + `esutlibrary.edu.ng` in Resend (DNS SPF/TXT records) | Resend console | Keys SET, domain verification is a human console step | Unblocks verification emails, overdue/hold notices, newsletters |
| 2 | **Rotate the GitHub personal access token** that is currently embedded in the git remote URL (`git remote -v` shows it in clear) and switch to a credential helper | GitHub → Settings → Developer settings; `git remote set-url origin https://github.com/ceesam111/esut-smart-library.git` | **Exposure risk — do first** | Removes a live credential from local config where any `git remote -v` print would leak it |
| 3 | Create the **production hosting target** (domain, TLS, host: Vercel/VPS) and fill `.env.production` (`APP_BASE_URL`, `NEXT_PUBLIC_*`) | Hosting + registrar | No production deploy yet (preview-only policy) | Real users can reach the site |
| 4 | Provision the **production Supabase project** (or promote the dev one), apply migrations, re-run RLS checks | Supabase console | Dev project working | Durable data + auth outside your laptop |
| 5 | Decide **loan rules, fine schedule, patron categories, retention schedule**, and sign off the DPIA | Library management | Policy, not code | Staff can operate consistently; legal basis documented |
| 6 | **Catalogue bulk data**: export current catalogue (CSV/MARC) for import; barcode label printer for physical items | Existing library system | Not yet ingested | Real holdings visible |

### 14.2 Optional API keys (enrichment & integrations) — all optional, features degrade gracefully

| Key (env slot) | Used by | Status | What you get when set |
|---|---|---|---|
| `CORE_API_KEY` | federated search (server `discovery.ts`) | **SET 2026-10-10** — live probe HTTP 200 | CORE aggregator full-text hits |
| `NCBI_API_KEY` (+ `NCBI_EMAIL` — default filled) | PubMed adapter | **SET 2026-10-10** — live probe HTTP 200 | Higher NCBI rate limits |
| `GOOGLE_BOOKS_KEY` | Supabase edge functions `ebook-search`/`federated-search` (dormant — the live search path is the server route) | **SET 2026-10-10** — live probe HTTP 200 | Activates Google Books results if those edge functions are deployed/used |
| `SEMANTIC_SCHOLAR_KEY` | edge functions `federated-search`/`publication-fetch` | **EMPTY** → Edge Function secret | Citation data enrichments |
| `ZENODO_TOKEN` | DOI minting (`server/identifiers/zenodo.ts`, Repository admin) | **SET 2026-10-10** — live probe HTTP 200 | Real DOI minting (else repository uses its own IDs); `mintDoi` now sends a `User-Agent` (fix this run — Zenodo rejects default fetch agents) |
| `AI_GATEWAY_API_KEY` (+ `AI_GATEWAY_BASE_URL` SET) | OmniRoute/agent gateway path | **EMPTY** (unchanged) | Central routing of AI calls; direct `GEMINI_API_KEY`/`GROQ_API_KEY` are already SET as the working path |
| `ELEVENLABS_*` | AI voice replies (`app/api/ai/lyria-voice/route.ts`) | **SET** | Text-to-speech in AI librarian |
| `ARCJET_KEY` / `ARC_JET` | bot protection in `middleware.ts` | **SET 2026-10-10** — active; `/`, `/login`, `/catalogue`, health all HTTP 200 with it on | Bot/shield layer on top of the custom rate limiter |
| `DISCOURSE_URL`/`DISCOURSE_SECRET` | `supabase/functions/discourse-sso` | **EMPTY** (`discourseEnabled: false`) | External Discourse forum SSO (built-in forum works without it) |
| Cloudflare Turnstile (`NEXT_PUBLIC_CLOUDFLARE_SITE_KEY` + site/secret) | CAPTCHA on sensitive forms | **Off by design** (`config` returns `siteKey: null`; public key env absent) | Turn on registration/spam CAPTCHA — requires creating a Turnstile widget in Cloudflare |
| Institutional **OIDC/SAML/LDAP** SSO | not implemented (P2) | — | Campus-wide login; needs an IdP decision first |
| **Z39.50 targets / SRU peers** | real copy-cataloguing | network reachability required | Fetch records from British Library/LoC etc. |
| **OAI-PMH harvesting by Google Scholar/OpenAIRE** | external harvesters | needs public URL + registration | Repository becomes citable/harvested |

### 14.3 Policy, people, hardware, content

- **Hardware**: QR/webcam at each gate (scanner page works on any camera device), a
  dedicated gate tablet running `/offline` or scan station, barcode **label printer**,
  self-service kiosk PCs for SIP2, receipt/slip printing is *not* built (Koha-parity gap).
- **People**: train officers on SLAAS scan + corrections; name a Super Admin (CEO level)
  and a backup librarian account; approve-run patron registration batches.
- **Content**: seed blog/events/newsletter/team photos, library manual pages, contact
  details, subscribed-database URLs, consortium partner list.
- **External reviews** (open P2s): accessibility conformance review, penetration test,
  webometrics targets/rank baseline (nav hidden while `features.webometrics = false`),
  i18n French copy review by a native speaker, analytics data pipeline (page currently
  shows live event counts from implemented tracking but token-level search analytics remain
  UI-only).

---

## 15. Revalidation log (2026-10-10)

Method: re-read role definitions, sidebar gates, route guards, API `requireRole` calls, env
contents (names/status only), and public routes directly from source after the final
verification run; cross-checked against `docs/features-by-role-and-benchmark.md`.

**Confirmed consistent**
- Role model identical across `roles.config.ts` (10), `permissions.ts` (10 + legacy `admin`),
  and the `app_role` enum migration.
- Admin entry gate: `!isApproved || !roleCan(role,'adminPanel')` → "Admin Access Restricted"
  (`AdminLayout.tsx:118`); 51 nav links in 10 groups; per-item filters (`feature`,
  `accountManager`, `module` → `canSeeCatalog`/`canSeeIr`, `roles`) all enforced at line 174.
- SLAAS API matrix: scan/manual/visitors/corrections/passes/identities →
  `LIBRARY_ADMIN_ROLES`; branches/visits/export/analytics/occupancy → `GLOBAL_ADMIN_ROLES`;
  patron self-read `/api/access/me` unauthenticated-by-role (self-scoped data).
- Login = email+password with verification-not-lockout; forgot/reset routes present; no MFA
  (known P2); admin 30-minute inactivity sign-out.
- Env audit: all critical runtime slots SET (Supabase, B2×3 buckets, Resend, Gemini/Groq,
  ElevenLabs, worker, SLAAS QR secret, rate limits). Every env var referenced in code but
  absent from `.env.local` has a safe in-code default or is test-only
  (`OAI_*`, `NCBI_EMAIL`/`UNPAYWALL_EMAIL`, `RESEND_FROM_NAME`, `SUPABASE_SECRET_KEY`,
  `COAR_NOTIFY_*`, `LOG_LEVEL`, `PRESERVATION_CADENCE_DAYS`, `AI_PROVIDER_ORDER`,
  `REGISTRATION_RECOVERY_SECRET`, `E2E_*`/`SEED_*`/`VITE_*`).
- Gates from the final run remain the current baseline (tsc 0 / lint 0/0 / 766 tests /
  554/554 live E2E / health 200).

**Discrepancies found today and how they were handled**
1. `docs/features-by-role-and-benchmark.md` is **stale** (pre-batch 8–17): it still says
   "Z39.50 simulated", "no OAI-PMH", "no offline/SIP2", "notices = email verify + in-app",
   "reports = counters", "single language", "analytics mock", "no preservation/AIP",
   "DOI manual". Superseded by this runbook + the audit docs; a banner pointing here was
   added to that file.
2. Claimed `/admin/audit-logs` route does not exist — the **audit view lives inside Account
   Management** (`/admin/accounts`). Corrected here.
3. Admin sidebar omits some pages that exist as routes (fines, theses, harvest,
   authorities, batch-modify, MARC import, stats pages, communities, CMS menu) — verified
   they are all **reachable via in-page links**, not orphaned; documented as secondary pages.
4. `ELEVENLABS_*`, `DISCOURSE_*`, `GOOGLE_BOOKS_KEY`, `SEMANTIC_SCHOLAR_KEY` first looked
   unused (early scan covered `src/` with dot-syntax `process.env` only); a repo-wide scan
   shows they are used (`app/api/ai/lyria-voice`, `supabase/functions/*` via `Deno.env`) —
   status corrected in §14.
5. **GitHub PAT embedded in the origin remote URL** (found via `git remote -v`); confirmed
   **not** present in any tracked file (`git grep` clean) — action item #2 in §14.1, token
   value deliberately not reproduced anywhere.
6. `docs/audit/final-platform-capability-reconciliation.md` had formatter-only churn
   (table separator rows) in the working tree — restored to the committed version; working
   tree now contains only known untracked reports/scripts.
7. **No patron self-hold (OPAC self-service reservation)** — reverified 2026-10-10: the
   only code that inserts into `reservations` is the staff circulation desk
   (`admin/Circulation.tsx`); patrons get course-reserve interest clicks
   (`reserve_clicks`) and staff-placed holds they can view. Self-service via ILL works.
   Decision for the product owner: add a Koha-style "Place hold" button on the item page,
   or keep holds desk-only by policy.
8. No code was changed during this revalidation (documentation only).

**Nothing missing that the code can supply**: every gap identified maps to an external key,
DNS/hosting step, policy decision, hardware purchase, or explicitly deferred feature (see
`docs/audit/final-platform-capability-reconciliation.md` Part B and the red-team doc's
blocked-external list).

**Post-revalidation update (same day)**: the product owner supplied `ARC_JET`,
`ARCJET_KEY`, `ZENODO_TOKEN`, `GOOGLE_BOOKS_KEY`, `NCBI_API_KEY`, `CORE_API_KEY` in `.env`
(and `.env.local`). Applied and verified: all four external APIs probed HTTP 200 status-only,
Arcjet active without blocking normal pages, search E2E 24/24, unit gates re-run after the
Zenodo `User-Agent` fix — tsc 0, lint 0/0, vitest 766/766. `.env*` stay gitignored; in
Coolify these six keys must also be added to the runtime environment (DEPLOYMENT.md list).
