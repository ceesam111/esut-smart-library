# ESUT Smart Library — Complete Platform Runbook (All User Roles)

Purpose: tell **every user level** exactly what features they have, how to use them effectively,
what the **system administrator** must do and watch, and which **human/external actions** (API keys,
DNS, policies, hardware) remain outside the code. **§0 is a complete human test manual** for
walk-testing the whole platform against production — start there if you are here to test.

Validation basis: re-read from the running codebase and probed against **live production** on
**2026-10-30** at commit `9b060e5` + the uncommitted Phase 22 working tree (git porcelain: 110
entries, **staged 0**). Evidence collected 2026-10-30:

| Gate / probe | Result (2026-10-30) |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npx eslint . --max-warnings=0` (full repo) | **exit 0** |
| `npx vitest run --maxWorkers=1` (serial) | **1003 / 1003 passed, 115 files, exit 0** (96.6 s) |
| Live production smoke (27 endpoints) | **all HTTP 200**; homepage HTML contains **no** `localhost:3000` |
| Live CSRF probe matrix (7 cases) | **exactly as specified** (§0.4) — cookie issued, positive passes, all three negatives 403 |
| OAI-PMH (Identify, ListSets, ListMetadataFormats, ListIdentifiers, ListRecords, GetRecord, badVerb) | **all HTTP 200 valid XML** |
| SRU (`operation=explain`, valid CQL `searchRetrieve`) | **HTTP 200** valid SRW XML |
| Coolify app state | `running:healthy`, image `ghcr.io/ceesam111/esut-smart-library:20261026-0947`, container up since 2026-10-26 18:30:23 |
| Env integrity | 8 `.env*` files present; **7/7 hold-copy SHA-256 match** (unchanged) |

Test baseline: 766 (2026-10-10) → **1003** (Phase 22; +206, zero removed/skipped).
Where the older `docs/features-by-role-and-benchmark.md` is stale, this runbook supersedes it (see §15).
Changes since the previous revision of this runbook are logged in **§15b (2026-10-30)**.

---

## 0. Human test manual — walk-test the whole platform (validated 2026-10-30)

Everything in §0 was verified by live probe or source read on **2026-10-30** unless marked
otherwise. Follow the phases in order; each phase tells you what you should see.

### 0.1 What you are testing (live state first)

| Fact | Value (observed 2026-10-30) |
|---|---|
| Production URL | `https://virtuallibrary.esut.edu.ng` |
| Running image | `ghcr.io/ceesam111/esut-smart-library:20261026-0947` (Phase 22 build) |
| App status | Coolify `running:healthy`; container continuously up since **2026-10-26 18:30:23** |
| Database | production Supabase project `rnnjspkdhojoigncdgmy`; **all 100 migrations applied** (last 6 applied 2026-10-26) |
| Data present | `catalogue_items` **29**, `repository_items` **4**, `patrons` **6**, `user_roles` **7** (service-role exact counts, 2026-10-30) |
| Data empty today | `theses` 0, `item_versions` 0, `loans` 0, `researcher_profiles` 0, `access_visits` 0 (+ fines, reservations, ILL, reading lists, course reserves, blog posts) — most flows below will show **empty states until you create the first row** |
| Local dev target | `.env` and `.env.local` point at the **same production Supabase project** — running the app locally writes production data; treat local runs as production |
| Never run here | `npm.cmd run seed:demo` / `seed:demo:verify` — demo seeding overwrites data |

### 0.2 Step 0 — provision test accounts (do this first)

You need sign-ins before §0.6. Pick one path:

- **Option 1 — use an existing account.** 7 role grants already exist in production
  (`user_roles`). If the product owner already gave you a staff login, use it.
- **Option 2 — bootstrap a fresh super admin** (this workspace targets production, and
  `SUPABASE_SERVICE_ROLE_KEY` is present in `.env`):
  `npm.cmd run bootstrap:super-admin -- --email=<you>@esut.edu.ng --level=ceo --name="Full Name"`.
  Then sign in at `/login` — you land on `/admin`.
- **Option 3 — self-register and approve.** The default registration policy is
  `email_verification_with_branch_approval` (`DEFAULT_REGISTRATION_POLICY`,
  `src/lib/registrationPolicy.ts`; stored in `app_settings`, shown as radios on
  **`/admin/accounts`** for super_admin only). Two gotchas:
  - The verification code is emailed — **Resend domain verification is still an open
    human action (§14.1 item 1), so the code may never arrive**. Workaround: a super admin
    switches `/admin/accounts` → *Registration access policy* → **Direct access after
    registration** for the test window, then restores it afterwards.
  - Login **proves the password first** (`Login.tsx:120`) — email verification never blocks
    sign-in — but a `pending` patron profile without approval receives **no privileges**
    (role resolution falls back). Approve pending accounts at `/admin/accounts`.

Recommended matrix (create these four via whichever option you chose):

| Account | Role to hold | Unlocks |
|---|---|---|
| `student1` | `student` | §0.6 student + §0.7 thesis flows |
| `lecturer1` | `researcher_lecturer` | deposit, ORCID verify, reading lists |
| `librarian1` | `librarian` | full admin panel, approvals, accounts, SLAAS |
| `super1` | `super_admin` | role grants, registration policy, SLAAS config |

Account creation + role grants happen at **`/admin/accounts`** (super_admin/librarian only).

### 0.3 Phase A — anonymous smoke (browser, ~10 min, no login)

Every URL below returned **HTTP 200** on 2026-10-30:

| Open | What you must see |
|---|---|
| `/` | Home renders; **view-source contains no `localhost:3000`**; `<link rel="canonical">` is `https://virtuallibrary.esut.edu.ng/` |
| `/api/health` | `{"ok":true,"service":"esut-smart-library","timestamp":…}` |
| `/catalogue` | 29 records, working facets/keyword search; open an item detail |
| `/search/global` | one box → local catalogue + repository + external source tabs (try `african` — the server returns real results, ~290 KB) |
| `/repository` | 4 published items; open one — **view counter** increments once per viewer per 5 minutes |
| `/theses`, `/thesis/status` | 200 with empty states (0 theses) |
| `/databases`, `/subscribed-databases`, `/open-access-databases`, `/course-reserves` | 200 |
| `/ai-librarian`, `/ai-tools` | 200 (chat answers need the AI keys — Gemini/Groq are set, §14.2) |
| `/faq`, `/library-manual`, `/newspapers`, `/forum`, `/events`, `/blog` | 200 |
| `/register`, `/login`, `/forgot-password` | 200 forms |
| `/dashboard`, `/admin` | page shell loads; as a guest you get **no** privileged content (client gate sends you to login/public) |
| `/robots.txt` + 5 sitemaps (`/sitemap.xml`, `/catalog-sitemap.xml`, `/repository-sitemap.xml`, `/theses-sitemap.xml`, `/sitemap-static.xml`) | 200, canonical host, no `localhost` |
| `/api/url-report?path=/` | 200 JSON with `canonical`/`hreflang`/`i18n` |
| header language switch EN ↔ FR | labels change, same page |

### 0.4 Phase B — security/API probes (curl, ~5 min, no login)

Windows ships `curl.exe`. Fetch the CSRF cookie first, then run the matrix. Replace `<uuid>`
with the `csrf-token` cookie value (it is a random UUID — not a secret).

```
1) cookie      curl.exe -s -D - -o NUL https://virtuallibrary.esut.edu.ng/ | findstr csrf-token
2) positive    curl.exe -s -o NUL -w "%%{http_code}" -X POST -H "content-type: application/json" ^
                 -b "csrf-token=<uuid>" -H "x-csrf-token: <uuid>" ^
                 -H "Origin: https://virtuallibrary.esut.edu.ng" -d "{}" ^
                 https://virtuallibrary.esut.edu.ng/api/events/track
3) no header   (same, omit the x-csrf-token -H)
4) wrong value (same, -H "x-csrf-token: wrong")
5) evil origin (same, -H "Origin: https://evil.example")
6) no cookie   (same, omit -b and the x-csrf-token -H)
```

Observed 2026-10-30 (probe A–H):

| # | Case | HTTP | Body |
|---|---|---|---|
| 2 | cookie + matching header + same origin | **400** | `{"error":"Invalid payload"}` — **success**: passed CSRF, reached the route (empty `{}` fails its payload check) |
| 3 | cookie, no header | **403** | `CSRF check failed.` |
| 4 | cookie + wrong header | **403** | `CSRF check failed.` |
| 5 | evil Origin | **403** | `Origin not allowed.` |
| 6 | no cookie at all | **400** | `{"error":"Invalid payload"}` — cookie-less requests pass the gate |
| 7 | `GET /api/search/resources?q=african` | **200** | JSON results |
| 8 | exempt prefix, cookie but no header: `POST /api/registration/send-verification` | **400** | `Authentication or registration context required.` — proves exempt paths reach the route |
| 9 | `POST /api/ai/reference-librarian` (cookie, no header) | **403** | `Request blocked.` — this is **Arcjet**, not CSRF (see §0.10.1) |

### 0.5 Phase C — account & session lifecycle

1. **Register** (per §0.2 Option 3) → confirmation state appears even if no email arrives.
2. **Sign in** at `/login` with the right password → correct landing page for the role
   (`/admin` staff, `/dashboard` patrons).
3. **Wrong password ×5** (same email) → lockout message, 15 minutes
   (`MAX_ATTEMPTS = 5`, `LOCKOUT_MS = 15 min`, client-side in `sessionStorage`) — clear
   site data or wait to reset.
4. **Forgot password** at `/forgot-password` → reset link flow (email must deliver; §14.1).
5. **As a patron, open `/admin`** → "Admin Access Restricted" (`AdminLayout` gate), and
   privileged API routes return 403/401 server-side — hiding the menu is never the only check.
6. **Language switch** persists across pages; **Library Card** QR renders at
   `/dashboard/library-card`.
7. **Admin inactivity**: leave an admin page idle 30 minutes (`INACTIVITY_MS`) → sign-out.

### 0.6 Phase D — role walkthroughs (log in as each)

**Student** (§3 for detail): `/dashboard` overview → My Account → Library Card →
**My Access** (empty until a gate scan) → My Loans (empty → staff create a loan at
`/admin/circulation` and it appears) → ILL → Reading Lists → **My Thesis** (§0.7) →
My Submissions → Course Reserves → My Reservations → Settings.

**Researcher / Lecturer** (§5): `/repository/submit` deposit flow → your item appears in
the review queue and, once approved, in `/repository` (DOI minting attempted via
Zenodo because `ZENODO_TOKEN` is set; otherwise an internal ID) → `/dashboard/lecturer-profile`
**ORCID verify** (paste a valid 16-digit code → verified; wrong code → mismatch; already-used
code → conflict) → reading lists → supervisor views under `/supervisor/theses` if assigned.

**Librarian / Super admin** (§7, §11): `/admin` shows **51 rendered nav items in 10 groups**
(52 defined; *Webometrics* hidden by `features.webometrics: false`). Then exercise:

| Page | Phase 22 check |
|---|---|
| `/admin/reports` (builder), `/admin/notices` + templates/test-send, `/admin/notices/delivery`, `/admin/circulation`, `/admin/catalogue/authority-merge`, `/admin/catalogue/new`, `/repository/submit` (deposit form), `/admin/catalogue/batch-modify` | These 8 pages previously called their APIs **without an Authorization header** and silently rendered empty/401. On the deployed image they must now **return real data** while you are logged in |
| `/admin/approvals` | approve a pending registration; decision is audit-logged |
| `/admin/accounts` | grant/revoke roles, suspend, audit log, registration-policy radios (super only) |
| `/admin/preservation` | Backups / Retention / AIP / Fixity tabs; note the **export API is curl-only** (no UI button yet) |
| `/admin/agents` | jobs/runs/metrics; two new jobs `preservation.backupMonitor` + `retentionReview` — see §0.10.11 |
| `/admin/access/*` SLAAS | create a **branch first**, then scanner/visitors/visits (§12) |

### 0.7 Phase E — thesis E2E (the 42P17 regression check)

Before 2026-10-26 every logged-in thesis page returned **HTTP 500 `42P17`** (RLS policy
recursion), fixed by migration `20261026090000` and verified live at deploy. Reproduce end-to-end:

1. As `student1`: `/dashboard/thesis` → submit a thesis → it lists immediately with a reference.
2. `/thesis/status` → lookup by that reference works (public).
3. As `lecturer1` assigned as supervisor: `/supervisor/theses` → the thesis is visible.
4. Admin: thesis appears in the admin thesis list.

**Any 500 on these pages is a regression — report it.** All four tables are still empty
(0 rows), so you are creating the first rows.

### 0.8 Phase F — circulation, SLAAS, offline (hardware-dependent, optional)

- **Loan round-trip**: staff `/admin/circulation` checkout to `student1` → student My Loans
  shows it → renew → return; test an overdue fine if you advance due dates.
- **Gate scan**: `/admin/access/scanner` with a QR (Library Card) on any webcam →
  admit/deny + visit row; patron sees it in `/dashboard/access`; corrections queue on the
  visits page.
- **Offline kiosk**: open `/offline` on a tablet (queues locally, syncs; backlog at
  `/admin/offline-sync`).
- **SIP2**: local listener `npm.cmd run sip2`; production containers `esut-sip2`/`esut-worker`
  were recreated 2026-10-11 and rebuilt images exist — see §0.10.11 for verification.

### 0.9 Phase G — interoperability & SEO (all probed 2026-10-30)

| Probe | Expected |
|---|---|
| `/api/oai?verb=Identify` | 200 OAI-PMH XML |
| `verb=ListSets`, `ListMetadataFormats` | 200 XML |
| `verb=ListRecords&metadataPrefix=oai_dc&set=public` | 200 XML |
| `verb=ListIdentifiers&metadataPrefix=oai_dc&set=public` | 200 XML |
| `verb=GetRecord&metadataPrefix=oai_dc&identifier=oai:virtuallibrary.esut.edu.ng:<item-id>` | 200 XML |
| `verb=badVerb` | HTTP 200 with `<error code="badVerb">` (OAI-PMH style) |
| `/api/sru?operation=explain&version=1.2` | 200 SRW explain XML |
| `/api/sru?operation=searchRetrieve&version=1.2&query=dc.title%20%3D%20%22digital%22` | 200 `<numberOfRecords>` (0 today — no catalogue title contains "digital"; a **bare term** like `query=digital` correctly returns HTTP 400 diagnostic `info:srw/diagnostic/1/10`) |
| 5 sitemaps + `/robots.txt` | 200 (already in Phase A) |
| Citation export (`/api/repository/<id>/citation?format=bibtex\|ris`) | works in the **browser**; scripted requests get Arcjet 403 (§0.10.1) |

### 0.10 Expected failures — do NOT report these as new regressions

1. **Arcjet 403 `Request blocked.`** on scripted/curl calls to sensitive prefixes
   (`/api/repository*`, `/api/ai/*`) — verified live 2026-10-30; browsers are unaffected;
   real-user impact remains an open determination (no claim made either way).
2. **`/admin/analytics` KPIs show 0 for everyone** on the deployed image: the page called
   `/api/admin/analytics` without an Authorization header → route returns 400/403 → UI falls
   back to zeros. **Fixed in the working tree 2026-10-30** (`authHeaders()`), gates green,
   **not yet deployed** — needs the next image build. Also note `catalog_admin` passes the
   page gate but not the route gate (`GLOBAL_ADMIN_ROLES`): a pre-existing page/route
   mismatch, deliberately **not** changed (that would alter permissions).
3. **`/admin/catalogue/marc-import` always shows "No import batches yet."** (same
   missing-header bug on both fetches) — fixed in the working tree 2026-10-30, pending deploy.
4. **`/admin/newspaper-index` → Run harvest** flashes "Harvest failed: Staff access required." —
   same bug; fixed in the working tree 2026-10-30, pending deploy.
5. **`/admin/workflows` → "My queue" is always 0**: the page calls `GET /api/workflows/tasks`,
   which **does not exist** (404) — open defect, not yet fixed. The workflow list itself loads.
6. **Emails may not arrive** (verification codes, notices) — Resend domain verification is
   an open human action (§14.1 item 1).
7. **No CAPTCHA** on forms — Turnstile returns `siteKey: null` by design (§14.2).
8. **ORCID linking is manual-code only** — OAuth app creation is a human console action.
9. **No Google Search Console / field CWV data** exists, so no indexing or CWV claim is made.
10. **Empty states are normal** — theses, loans, fines, reservations, visits, profiles tables
    have 0 rows (§0.1).
11. **Production worker image version is unverified from here**: GHCR shows
    `worker-latest`/`sip2-latest` last published **2026-10-23** (app image is 2026-10-26).
    If the running `esut-worker` container predates 2026-10-23 the two new preservation jobs
    will be absent. Verify on the VPS:
    `docker inspect esut-worker --format '{{.Image}} {{.Created}}'` (then `docker pull` +
    `docker run` from `worker-latest` if stale).

### 0.11 Recording your results

| # | Phase / step | Expected (§ reference) | Observed | Pass / Fail | Notes |
|---|---|---|---|---|---|
| 1 | | | | | |

Report failures with the exact URL, HTTP status and a screenshot; §15 (2026-10-10) and
§15b (2026-10-30) list what was already
known on 2026-10-30 so new findings are unambiguous.

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

1. **Register** at `/register` (institutional email + password + profile fields). The
   registration **access policy** governs what happens next — default
   `email_verification_with_branch_approval`; super_admin can switch it on
   `/admin/accounts` between *Direct access*, *Email verification*, and *Email verification
   plus branch approval* (`src/lib/registrationPolicy.ts`, stored in `app_settings`).
2. **Admin approval**: a `super_admin` or `librarian` opens `/admin/approvals` and approves the
   pending account (patron-approval API reads require `GLOBAL_ADMIN_ROLES` — see
   `canReadApprovalItem` in `permissions.ts`). A `pending` profile without approval has
   **no privileges** even though sign-in works.
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

**Entry**: any public URL, no login. The app defines **144 client routes** (`src/App.tsx`)
served by a Next catch-all, plus **152 API routes** (`app/**/route.ts`); the guest-visible surface:

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
**plus Arcjet**, which is active in production (`ARCJET_KEY`/`ARC_JET` SET — see §14.2; it
returns `Request blocked.` to scripted clients on sensitive prefixes, §0.10.1).

**How to use effectively**: start at `/search/global` — it searches the local catalogue,
repository and 14 external sources in one box; use `/catalogue` for pure OPAC browsing with
facets.

---

## 3. Student

**Home**: `/dashboard`. **Sidebar (13 links defined; 12 render for students — Research
Profile is lecturer-only)** — `DashboardLayout.tsx`:

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

Everything visible: all **51 rendered admin sidebar links** (52 defined across 10 groups —
Overview, Patrons, Collections, Academic, Content, Reporting, Consortium, Circulation,
**SLAAS**, System; *Webometrics* stays hidden while `features.webometrics = false`) plus
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
| **Production (live)** | Coolify-managed container on the VPS — **not** run from this machine | Image `ghcr.io/ceesam111/esut-smart-library:20261026-0947`, `running:healthy`, fqdn `https://virtuallibrary.esut.edu.ng` (details §15, §15b) |

Useful scripts: `seed:demo`, `seed:demo:verify`, `bootstrap:super-admin`,
`scan:secrets`, `scan:sast`, `test:coverage`. Backups: `scripts/backup.sh`,
`scripts/restore.sh`, DR rehearsal `scripts/backup-restore-slaas-live.mjs`.

**Production image roll** (needs owner approval): build & push a new stamp image, then
`PATCH http://<vps>:8000/api/v1/applications/dgbxbva96eayp8ktfc3guqi0` with
`{"docker_registry_image_tag":"<tag>"}` and trigger `POST /api/v1/deploy` (API key from the
ops credentials file — key passed only in headers, never logged). Known-good rollback tags:
`20261023-0259` and `20261020-2101`.

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
- **Gates before any release**: `typecheck`, `lint`, `test` (1003 as of 2026-10-30 — run
  `npx.cmd vitest run --maxWorkers=1`; parallel workers starve this 4-core/7.6 GB machine),
  `scan:secrets`, `scan:sast`, `npm audit --omit=dev` — all also enforced in
  `.github/workflows/ci.yml`.
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
  `APP_BASE_URL`, `CORS_ALLOWED_ORIGINS`) **plus Arcjet, active** (`ARCJET_KEY`/`ARC_JET`
  SET in `.env.local` and in the Coolify runtime env).
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

Status verified against `.env.local` on 2026-10-10 and **re-verified 2026-10-30** (**SET** =
value present; secrets are never printed by DWC). Production runtime env additionally holds
the keys listed in `DEPLOYMENT.md` (51 keys loaded into Coolify 2026-10-11).

### 14.1 Must-do to unblock real operation

| # | Action | Where | Current status | Effect when done |
|---|---|---|---|---|
| 1 | **Verify sending domains** `esut.edu.ng` + `esutlibrary.edu.ng` in Resend (DNS SPF/TXT records) | Resend console | Keys SET, domain verification is a human console step | Unblocks verification emails, overdue/hold notices, newsletters |
| 2 | **Rotate the GitHub personal access token** that is currently embedded in the git remote URL (`git remote -v` shows it in clear) and switch to a credential helper | GitHub → Settings → Developer settings; `git remote set-url origin https://github.com/ceesam111/esut-smart-library.git` | **Exposure risk — do first** | Removes a live credential from local config where any `git remote -v` print would leak it |
| 3 | **Production hosting target** — domain + TLS + host | registrar + VPS (Coolify) | **DONE 2026-10-11**, live on `https://virtuallibrary.esut.edu.ng`, image `20261026-0947` (verified healthy 2026-10-30) | Real users reach the site — the platform is publicly deployed |
| 4 | **Production Supabase project** + migrations + RLS | Supabase console | **DONE** — project `rnnjspkdhojoigncdgmy` in production use; **all 100 migrations applied** (last 6 on 2026-10-26) | Durable data + auth outside your laptop |
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
| `ARCJET_KEY` / `ARC_JET` | bot protection in `middleware.ts` | **SET — active** (re-verified 2026-10-30: normal pages 200; scripted calls to `/api/repository*` and `/api/ai/*` → 403 `Request blocked.`, §0.10.1) | Bot/shield layer on top of the custom rate limiter |
| `DISCOURSE_URL`/`DISCOURSE_SECRET` | `supabase/functions/discourse-sso` | **EMPTY** (`discourseEnabled: false`) | External Discourse forum SSO (built-in forum works without it) |
| Cloudflare Turnstile (`NEXT_PUBLIC_CLOUDFLARE_SITE_KEY` + site/secret) | CAPTCHA on sensitive forms | **Off by design** (`config` returns `siteKey: null`; public key env absent) | Turn on registration/spam CAPTCHA — requires creating a Turnstile widget in Cloudflare |
| `OAI_TOKEN_SECRET` | signing OAI-PMH resumption tokens (`docs/interoperability/oai-pmh.md`) | **ABSENT (re-verified 2026-10-30)** — code falls back to `SUPABASE_SERVICE_ROLE_KEY` | Dedicated token-signing secret so the OAI token key is not the service-role key |
| `NEXT_PUBLIC_APP_URL` | alternate public-base-url slot | **ABSENT (re-verified 2026-10-30)** — `NEXT_PUBLIC_APP_BASE_URL` + `APP_BASE_URL` are SET and used; no functional gap | Only needed if code paths switch to this slot name |
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

## 15. Revalidation log (2026-10-10 — original pass; superseded by §15b where they differ)

Method: re-read role definitions, sidebar gates, route guards, API `requireRole` calls, env
contents (names/status only), and public routes directly from source after the final
verification run; cross-checked against `docs/features-by-role-and-benchmark.md`.

**Confirmed consistent**
- Role model identical across `roles.config.ts` (10), `permissions.ts` (10 + legacy `admin`),
  and the `app_role` enum migration.
- Admin entry gate: `!isApproved || !roleCan(role,'adminPanel')` → "Admin Access Restricted"
  (`AdminLayout.tsx:119`, now `src/components/layout/AdminLayout.tsx`); 52 nav items
  defined / **51 rendered** in 10 groups; per-item filters (`feature`,
  `accountManager`, `module` → `canSeeCatalog`/`canSeeIr`, `roles`) all enforced at line 175.
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
- Gates from that run were the baseline then (tsc 0 / lint 0/0 / 766 tests /
  554/554 live E2E / health 200) — **superseded 2026-10-30: 1003 tests, see §15b**.

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

**Post-revalidation CI/deploy verification (2026-10-11)**: first full GitHub Actions runs
were red; three root causes found and fixed, all verified locally before push:

1. **Extraction sandbox on Linux** — `extractWorkerEntry.ts` loaded `./engine` with an
   extensionless dynamic import; under Node's native type-stripping loader (Linux CI,
   `node:22` Docker) that fails with `Cannot find module '.../engine'`, failing all 10
   extraction tests in CI while passing on Windows (tsx hooks). Fixed with explicit
   `.ts` specifiers through the worker-loaded chain (`extractWorkerEntry`, `engine`,
   `docxText`, `ocr`) + `allowImportingTsExtensions` in `tsconfig.json`
   (commit `8b6cd80`); re-verified by spawning the worker with no loader (outcome
   `COMPLETE`) and vitest extraction 15/15.
2. **Hardcoded Windows paths in CI scripts** — `scripts/scan-secrets.mjs` and
   `scripts/sast-scan.mjs` used a fixed `C:\Users\LENOVO\...` project root, so on
   runners `git ls-files` returned nothing (`FATAL: no tracked files`, exit 2). Fixed to
   script-relative `PROJECT_ROOT` with `path.join` reads (commit `2c15d52`).
3. **SAST self-match** — the scanner's own rule strings matched the `eslint-disable`
   rule; baselined `scripts/sast-scan.mjs::eslint-disable`, following the existing
   `scripts/parse-ai-tools.mjs` precedent (file::rule keys, line numbers not stored).

Outcome: **CI Quality Gates fully green** — run `38117721363` (2026-10-11), 2m47s, all
steps passed: tsc, eslint, vitest (92/92 files), production build, npm audit (0
critical), secrets scan (1017 files, 0 findings), SAST scan (0 findings). Earlier CI
"green" claims in older docs were **local-only**; this is the first green hosted run.

Still red: **Build & Push Docker Image** — image builds (login + build pass) but push
fails verbatim with `denied: permission_denied: read_package` for
`ghcr.io/ceesam111/esut-smart-library:latest` (runs `38115223682`, `38117016800`,
`38117721367`). Cause: that package exists as a **private package not connected to this
repository**, so the workflow `GITHUB_TOKEN` (`packages: write`) cannot access it —
probes: anonymous token request returns 401 for this name vs 403 for a random name;
package-link API returns 404; local `gh` token lacks `read:packages`. This needs the
package owner (GitHub web UI: package settings → connect this repository with
read/write Actions access, or delete/rename the stale package), then re-run the
workflow; Coolify deployment follows per `DEPLOYMENT.md`.

**GHCR resolved (2026-10-11)**: owner granted the local `gh` session `write:packages`
via the official device flow (token in keyring, never shown in chat), then connected
the package to the repository in the GitHub web UI — no REST endpoint exists for
this connection (verified against the current GitHub REST Packages docs; a test
workflow step using the assumed endpoint returned 404 and was removed in `2167b53`).
First fully green release pipeline: CI Quality Gates `38122415687` **success** + Build
& Push Docker Image `38122415650` **success** on `2167b53`; image
`ghcr.io/ceesam111/esut-smart-library:latest` published 2026-10-11T07:46:34Z
(verified via package-versions API: tag `latest`). Remaining deployment step:
Coolify must pull this image and receive the runtime environment variables per
`DEPLOYMENT.md` (including the six API keys applied above).

**Production cutover to Coolify-managed deployment (2026-10-11)** — delegated by the
product owner ("do it yourself"). End state: **live site served by the Coolify-managed
container**, old manual container stopped as rollback.

1. **Three-image pipeline** — `docker-build.yml` extended to build app + `Dockerfile.worker`
   + `Dockerfile.sip2` with stamp `20261011-1146`; the corrupted
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` reference was corrected (decoded ref matched
   `.env.production`; value never reproduced). Runs `38136793042` (CI) and `38136793015`
   (docker) green; six tags published: `latest`/`20261011-1146`,
   `worker-latest`/`worker-20261011-1146`, `sip2-latest`/`sip2-20261011-1146`.
2. **Runtime environment** — Coolify app env now has all **51 production keys** (12
   existing + 39 posted via API, values passed only in request bodies, never logged;
   field name is `is_buildtime`). `DIAG_TEST_*` probe keys created and deleted.
3. **GHCR pull on VPS repaired** — `/root/.docker/config.json` contained a corrupt ghcr
   auth blob; fixed by piping a fresh `gh` token to `docker login --password-stdin`
   (stdin only). Images `20261011-1146`, `worker-latest`, `sip2-latest` pulled.
4. **App deployed** — PATCH `docker_registry_image_tag=20261011-1146` + restart
   (deployment `umukxlvvhhvcm8cr1s6kqwyz` finished); container
   `dgbxbva96eayp8ktfc3guqi0-…` Up/healthy at `172.16.1.25:3000`, tagged immutable
   `20261011-1146`. Traefik labels regenerated by PATCH `{domains: "https://virtuallibrary.esut.edu.ng"}`
   (the original `custom_labels` baked in a stale `sslip.io` rule and never refreshed).
5. **Routing cutover** (file router backups `*.bak.20261011` on the VPS under
   `/data/coolify/proxy/dynamic/`):
   - Removed the esut routers/service from `esut-afued-routing.yaml` (afued block untouched).
   - `virtualdatabases-irepo.yaml` also declared `Host(\`virtuallibrary.esut.edu.ng\`)`
     pointing at an unrelated backend; its long rule out-prioritised the new label router
     and caused the initial **502**. Stripped only that host token (2 occurrences).
   - Label router now canonical; HTTP→HTTPS 301 confirmed.
6. **Proof of ownership** — after `docker stop esut-app-new` (exit 143), external checks
   still returned 200 (`/api/health`, `/`, `/catalogue`, `/search`), so live traffic is
   definitively on the Coolify container. Coolify reports `running:healthy`, tag
   `20261011-1146`, fqdn `https://virtuallibrary.esut.edu.ng`.
7. **Worker + SIP2 replaced** — recreated as `esut-worker` / `esut-sip2` from
   `worker-latest` / `sip2-latest` (today's digests) preserving names, env, `coolify`
   network, ports (SIP2 `6000` + `127.0.0.1:8788`), labels and `unless-stopped`.
   Health verified: worker `{"status":"ok","workerId":"esut-worker-1",…}` polling,
   SIP2 `{"status":"ok","port":6000,…}` + listener confirmed. Temporary
   inspect files containing env values were deleted from the VPS and local temp.
8. **Rollback** (if ever needed): `docker start esut-app-new`, then restore both
   `*.bak.20261011` router files and reload (traefik picks up dynamic config).
9. **Still open**: GitHub PAT embedded in the origin remote URL (rotation flagged, §14.1);
   Resend DNS verification; optional `SEMANTIC_SCHOLAR_KEY` / `DISCOURSE_*` keys.

No application code changed in this step (docs + ops only).

---

## 15b. Revalidation log (2026-10-30) — deep recheck before human acceptance testing

Method: three parallel source audits (roles/nav/routes vs claims; Phase 22 behavioral
changes; every page `fetch()` to a protected API cross-checked against its `requireRole`
guard), plus live production probes (smoke, CSRF matrix, OAI/SRU, data counts, Coolify +
GHCR state), env slot re-verification (names/status only), and a full gate re-run. Result:
this runbook was rewritten around a new **§0 human test manual**, and 4 code defects were
found — 3 fixed, 1 left open.

**Gates re-run 2026-10-30 (after the fixes below)**: `tsc --noEmit` **0**,
`eslint . --max-warnings=0` **0** (full repo), `vitest run --maxWorkers=1`
**1003/1003 passed, 115 files** (96.6 s), git **porcelain 110 / staged 0** (all Phase 22 +
this work uncommitted, as required).

**Live state re-verified 2026-10-30**
- Smoke: 27 endpoints all HTTP 200; homepage has no `localhost:3000`; CSRF cookie issued on `GET /`.
- CSRF matrix 7/7 as specified (table in §0.4) — positive reaches the route (`400 Invalid payload`),
  missing/wrong header → `403 CSRF check failed.`, evil origin → `403 Origin not allowed.`,
  exempt prefixes reach their routes.
- OAI-PMH: Identify, ListSets, ListMetadataFormats, ListIdentifiers, ListRecords, GetRecord,
  badVerb → all HTTP 200 valid XML. SRU: explain + valid-CQL searchRetrieve → 200 SRW XML.
- Coolify: `running:healthy`, image `20261026-0947`, container up since 2026-10-26 18:30:23.
  GHCR: app image 2026-10-26; `worker-latest`/`sip2-latest` last published 2026-10-23
  (worker container version on the VPS **not** verifiable from here — §0.10.11).
- Data (service-role exact counts): catalogue 29, repository 4, patrons 6, user_roles 7,
  theses/loans/item_versions/researcher_profiles/access_visits all 0.
- Env: 8 `.env*` files intact (7/7 hold-copy SHA-256 match). Re-confirmed absent:
  `OAI_TOKEN_SECRET` (falls back to service-role key), `NEXT_PUBLIC_APP_URL`
  (`NEXT_PUBLIC_APP_BASE_URL` present). `ARCJET_KEY`/`ARC_JET` SET and active.

**Defects found in this recheck**
1. **`/admin/analytics` KPIs always 0** — `Analytics.tsx:28` fetched
   `GET /api/admin/analytics` with **no Authorization header**; `requireUser` throws
   `Authentication required.` → route's catch returns **400** (not 403, so the earlier
   Phase-22 scan keyed on 401/403 missed it) → UI falls back to zeros. **Fixed**
   (added the established `authHeaders()` pattern, no new comments/strings).
   Adjacent, deliberately unchanged: `catalog_admin` passes the page gate
   (`Analytics.tsx:36`) but not the route gate (`GLOBAL_ADMIN_ROLES`) — changing either
   side would alter permissions, so it is documented instead (§0.10.2).
2. **`/admin/catalogue/marc-import` always "No import batches yet."** —
   `MarcImportPreview.tsx:53` and `:62` fetched without Authorization. **Fixed** (both calls).
3. **`/admin/newspaper-index` harvest always "Harvest failed: Staff access required."** —
   `NewspaperIndex.tsx:112` POSTed `/api/public/hooks/rss-fetch` without Authorization.
   **Fixed.** All three fixes re-verified: tsc 0, eslint 0, 1003/1003 — and are **not yet
   deployed**; production still shows the broken behavior until the next approved image
   build (§0.10.2–4).
4. **Open (not fixed): `/admin/workflows` → "My queue" is permanently empty** — the page
   calls `GET /api/workflows/tasks` (`Workflows.tsx:73`), a route that does not exist
   (only `/api/workflows/[id]/tasks`); it 404s and the queue renders 0 rows. Fixing needs
   a new global task-queue endpoint (design decision + tests), so it is documented as a
   known defect (§0.10.5).

**Corrections applied to earlier runbook text**
- Route inventory "142" → **144 client routes** (`src/App.tsx`) + **152 API routes**.
- Admin sidebar "51 links" → **52 defined, 51 rendered** (Webometrics hidden by
  `features.webometrics: false`); gate line `:118` → **`:119`** and filter line `:174` →
  **`:175`** in `src/components/layout/AdminLayout.tsx`.
- Student sidebar → **13 defined, 12 rendered** (Research Profile lecturer-only).
- "Arcjet … currently not configured" / "inactive until ARCJET_KEY is set" → **SET and active**.
- Test baseline **766 → 1003**; "No production deploy yet" / "Dev project working" →
  **deployed 2026-10-11, image `20261026-0947`, production Supabase fully migrated**.
- Registration reality added (§0.2): default policy
  `email_verification_with_branch_approval`, super-admin radios at `/admin/accounts`,
  Resend DNS still open, password-proven-first login.
- New verified facts: view counter (5-min de-dup), `localSearch` in Global Search,
  ORCID manual verify, preservation tabs (export API curl-only), identity hardening.

**Still open for the owner (unchanged or new)**: build+deploy an image containing the three
auth-header fixes; verify/rebuild the production `esut-worker` image (§0.10.11); provide
test accounts (§0.2); restore-drill (T10); staging write-matrix (deferred 2026-10-26);
GitHub PAT rotation; Resend DNS verification; Turnstile keys; GSC access; ORCID OAuth;
`OAI_TOKEN_SECRET`/`NEXT_PUBLIC_APP_URL`; 24 h post-deploy observation; deposit policy.
No GSC/indexing or field-CWV claim is made anywhere in this runbook. During this audit a
grep of `.env.development` incidentally surfaced plaintext credentials for the **already
deleted** dev Supabase project — values deliberately not reproduced; consider deleting that
stale file.
