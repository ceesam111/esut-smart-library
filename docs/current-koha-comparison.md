# Current Koha Comparison — ESUT Library vs Koha

Evidence-based competitive audit. Every ESUT claim verified from current code, schema, tests and live endpoints; Koha side from official koha-community.org release notes and manual (Koha 26.05 series).

## Versions Compared

- Comparison date: 2026-09-28
- **Koha baseline: 26.05.03** (released 26 May 2026; security/bugfix patch 24 Aug 2026; 2 features, 214 enhancements, 365 bugfixes in 26.05.00; supported branches: 26.05 / 25.11 / 24.11 / 22.11)
- **ESUT commit: `2625abb`** (production container `esut-app-new`, live at https://virtuallibrary.esut.edu.ng)
- Method: source + migration + route + test inspection, live endpoint probes, hosted-DB inspection. `docs/implementation-progress.md` claims were treated as unverified assertions.

Status legend: AHEAD · PARITY · BEHIND · PARTIAL · UNVERIFIED · NOT APPLICABLE.

## Section A — Capability Matrix

### 1. Cataloguing

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| MARC21/MARCXML | Export-only JSONB→XML/JSON lib (`src/server/catalogue/marc.ts`); no parser, no ISO 2709; production MARC handled by duplicated client code | Full MARC21 editor, ISO 2709 import/export, MARCXML, MarcEditor | **BEHIND** | `marc.ts` (69 lines, **0 production importers** — only `marc.test.ts`); `admin/Catalogue.tsx:374` hand-rolled MARCXML | Koha: 20+ yrs of MARC tooling; ESUT: unused server library | MARCXML **ingestion**, ISO 2709, validation | Build XML→object parser + validation; wire `marc.ts` as the single shared implementation |
| Advanced MARC editor | 33-tag UI editor (`admin/CatalogueNew.tsx:9-46`), simple↔MARC sync | Full tabbed MarcEditor with indicator/subfield editing | **BEHIND** | `CatalogueNew.tsx` (914 lines) | Koha far deeper (frameworks, leader editing) | Tag coverage, authority formats | Extend tag dictionary; add leader/008 editing |
| Frameworks/templates, MARC validation | ABSENT | Core Koha feature | **BEHIND** | No framework tables/migrations | — | Framework-based cataloguing + Z39.50 overlay rules | P1: template framework table + validation rules |
| Record overlay, batch edit | ABSENT (staging approve only) | Staged MARC imports, modification templates, batch item/bib edit | **BEHIND** | `catalogue/staging` routes exist; no batch-edit code | — | Batch modification templates | P1: batch edit for items (status/branch/itype) |
| Duplicate detection | ISBN exact + title fuzzy 0.85 (`src/server/catalogue/duplicates.ts` + tests + `/api/admin/duplicates`) | Catalog dedupe + merge wizard | **PARTIAL** | `duplicates.ts`, `duplicates.test.ts` | ESUT has detection, no **merge** | Record merge tooling | P1: merge/keep-one workflow |
| Import | CSV wizard (14 columns) → staging → approve (`stageImport`, `importValidation` + tests) | MARC staged imports, CSV, Z39.50 harvest | **PARTIAL** | `app/api/admin/catalogue/{import,staging,*}` | ESUT CSV-only, not MARC | MARC batch import, record overlay on import | P2: MARC import via SRU/Z39.50 gateway |
| Bibliographic relationships | Label only (tag 776 UI string) | 76X/77X + linking entries | **BEHIND** | No relationship table | — | Relationship data model | P3 |

### 2. Authority Control

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Authority records | `authority_control` term vocabulary (term, term_type, variants) | MARC authority records per authority type | **BEHIND** | `app/api/authorities` + tests; migration `20260928020000` | Koha: real MARC authorities; ESUT: keyword table | MARC authority format, heading structure | P1: promote to MARC-shaped records |
| Bib linkage | `authority_id`/`authority_heading` columns on catalogue + repository items | Auto-linking + relinking reports | **PARTIAL** | `20260928020000_authority_linking.sql` | Columns exist; no relink job | Automatic heading reconciliation | P2: nightly relink job |
| Merge / cross-references | ABSENT (no merge, no 4XX/5XX) | Authority merge + see/see-also refs | **BEHIND** | — | — | Merge + UF/USE refs | P2 |
| External lookup (VIAF/ISNI/LC) | ABSENT (ORCID/ROR are researcher/org identity, not bib authorities) | Z39.50 authority search, plugins | **BEHIND** | — | — | VIAF/LC heading lookup | P3 |

### 3. Z39.50 / SRU

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Z39.50 client | **ABSENT — relabelled Open Library REST** (in-code comment: `// Use Open Library as Z39.50 proxy (real Z39.50 requires server-side)`) | Real Z39.50 client: configurable targets, MARC retrieval, auth, timeouts, overlay into staging | **BEHIND** | `admin/CatalogueNew.tsx:308-340`; no z3950 lib in `package.json`; `z3950_imports` table stores mislabelled provenance; `Z3950_ENABLED` flag never read | Honest relabel achieved (WAVE 3), but protocol still absent | Real Z39.50 client (Yaz-compatible) with target config | **P1**: add server-side client (e.g. `yaz.js`/custom PDU) → MARC → existing staging pipeline |
| Z39.50 server | ABSENT | Koha exposes biblioserver (Zebra/ES) as Z39.50/SRU server | **BEHIND** | — | — | Host a Z39.50 server for union cataloguing | P3 (needs ops) |
| SRU server | Real SRW XML envelope (`searchRetrieveResponse`, diagnostics, Explain) but **query goes to Postgres `websearch_to_tsquery` — no CQL parsing** | SRU server with CQL indexes mapped from MARC | **PARTIAL** | `app/api/sru/route.ts` (live, 200; p50 326ms explain / 431ms search) | Envelope valid; retrieval layer not CQL | CQL parser + index mapping (`dc.title` etc.) | P1: minimal CQL (`title=`, `author=`, `and/or`) |
| SRU client | ABSENT | Usable via cat/search plugins | **BEHIND** | — | — | SRU import for cataloguing | P2 (pairs with Z39.50 gateway) |

### 4. Circulation

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Checkout/check-in/renewal | Working UI flows: `admin/Circulation.tsx` (checkout L148, check-in L270), renewal in `dashboard/Loans.tsx` (rule-aware `renewals`, `renewed_count`) | Production-hardened desk client, bulk ops | **PARTIAL** | tables `loans`, `circulation_transactions`; loan rules `institution.config.ts:98` (4 categories, fineRate 50 NGN/day) | Koha battle-tested; ESUT desk basics only; **owner reports barcode scanning + hold checkout broken** (`issues-to-fix.md` #13/#14) | Fix broken desk workflows first | **P0**: fix #13/#14 before parity talk |
| Holds/reserves | `reservations` table + hold-queue update in UI | Full holds queue, priorities, suspension, recalls | **PARTIAL** | `Circulation.tsx:329` | No queue policy engine | Hold notices, pickup logic | P1 |
| Loan/fine rules | Hard-coded config + runtime defaults (grace days, max, suspension) | Circulation rules matrix (category × itype × branch × locale), calendars | **PARTIAL** | `institution.config.ts`, `CatalogueItem.tsx:104` | Not DB-configurable; **no due-date calendar** (exam suspension = boolean) | DB-driven rules + `circulation_calendar` | P1 |
| Calendar-driven due dates | ABSENT | Koha calendars per branch | **BEHIND** | `calendar_events` exists but unused for due dates | — | Calendar math in checkout | P1 |
| Transfers/branch handling | ABSENT (no item transfer workflow) | Transfers with in-transit status, confirm receipt | **BEHIND** | — | — | Transfer workflow | P2 |
| Offline circulation | Offline queue + `/api/circulation/offline-sync` (tests exist) | Offline circ (Circulation wizard) + queue upload | **PARITY (concept)** / UNVERIFIED in prod | `offline-sync/route.ts` + test; **route has 0 frontend callers** — desk uses localStorage queue only | Both support offline capture; ESUT's server sync path unwired | Wire UI → sync endpoint | P1 |
| Overdues/lost items | Overdue fine on check-in; overdue reminder agent job (reported failing, #19) | Overdue notices, item lost workflows with charges | **PARTIAL** | `Circulation.tsx:270`; `worker/handlers` overdue job | No lost/damaged item workflow with charges | Lost-item process | P2 |
| Recalls | ABSENT | Hold→recall available | **BEHIND** | — | — | — | P3 |

### 5. Self Service (SIP2)

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| SIP2 server | Message parser exists (93/11/35) but **no TCP listener, no route, no flag; LOGIN never checks password** (any non-blank password + any existing librarian row authenticates); 3 trivial tests | Production SIP2 server (TCP), full message set, self-check + RFID vendors | **BEHIND** | `src/server/sip2/{server,messages}.ts`; grep: zero external callers; `SIP2_ENABLED` never read | **Code exists but is dead and insecure — not a functioning service** | TCP listener, SC-Status, real auth, checkin, checksum validation | **P0**: do not advertise SIP2 until listener + auth fixed; then P1 wiring |
| Self-check hardware interop | ABSENT | Many libraries run self-checkouts | **BEHIND** | — | Never interoperated (LEVEL 1 at best) | Hardware pilot | P2 (requires hardware) |

### 6. Patron Management

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Categories/registration/expiry/suspend/CSV import | Working: `patrons` (category, status, `membership_expires_at`), admin UI + import, role-aligned RBAC | Full patron modules incl. attributes, flags, guarantors | **PARTIAL** | `admin/Patrons.tsx`, `PatronsImport.tsx`, `permissions.ts`+tests | Koha adds patron attributes, guarantors, OPAC self-edit depth | Guarantors, card_number column (barcodes client-side only) | P2 |
| Permissions/auth | Custom RBAC (`requireRole`, 10-value `app_role`, feature flags via `roleCan`) | granular permission modules + superlibrarian | **PARITY (concept)** | `permissions.test.ts`, `requireRole.ts` (115 uses/50 files) | ESUT modern JWT+RLS; Koha mature granular UI | Permission admin UI depth | P3 |
| Auth integrations (SAML/OIDC/LDAP/CAS) | ABSENT (Supabase email/OAuth only) | LDAP, CAS, SAML(plugins), OIDC plugins | **BEHIND** | — | — | Institutional SSO | P1 (university requires) |
| Self-registration | Full multi-step registration + Turnstile (disabled) + email verify | OPAC self-registration with policies | **PARITY (concept)** | `/api/registration/*` (7 routes), `registration_policy` admin | Both support policy-controlled self-reg | Turnstile keys pending | P2 |

### 7. Acquisitions

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Vendors/budgets/POs/invoices | Schema complete: `acquisition_suppliers`, `purchase_orders` (draft→sent→partial→received→cancelled), `purchase_order_items` (received_qty), `supplier_invoices` (pending/paid/partial/disputed), `acquisition_budgets` (faculty+FY unique); 5-tab UI | Deep module: baskets, staged ordering, receiving by line, invoices with adjustments | **PARTIAL** | `admin/Acquisitions.tsx` (1058 lines) | **UI only flips status strings**: no line-level receiving UI, no budget encumbrance (budget never debited), no claims | Line receiving, encumbrance, claims workflow | **P1**: enforce budget = ordered+received totals |
| Suggestions | `purchase_recommendations` table + urgency/status | Purchase suggestions w/ patron interaction | **PARTIAL** | Acquisitions tab 1 | No patron-facing suggestion page | OPAC suggestions | P2 |
| Tax/shipping/discount/cancellations | ABSENT (status value only) | Invoice adjustments, GST/tax | **BEHIND** | — | — | Invoice line math | P2 |

### 8. EDI / EDIFACT

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| EDI | **X12 850 outbound generator only** (ISA/GS/ST segments; SE control count overstated by 2; ISA padding non-conformant); no parser, no responses, no EDIFACT anywhere; tests assert literal strings without calling the generator | Full EDI: EDIFACT ORDERS/ORDRESP/INVOIC/CLAIMS per vendor profile, file transport (SFTP/FTP), round-trip | **BEHIND (PARTIAL code)** | `src/server/acquisitions/edi.ts` (51 lines), `edi.test.ts` (vacuous), `/api/acquisitions/edi` (0 UI callers) | **No supplier has ever exchanged a message**; wrong standard for most non-US vendors (LEVEL 1) | EDIFACT parse+generate, vendor EDI profiles, transport | P2 — only if a real vendor demands it; until then label "prototype" |

### 9. Multi-currency

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Exchange rates/base currency/historical rates | **ABSENT** — `currency` columns default NGN, UI hardcodes `'NGN'`; grep `exchange_rate|fx_rate` = 0 | Currencies module with rate tables + historical rates | **BEHIND** | `Acquisitions.tsx` L497/748/903/961 | Column exists for labelling only | Currencies table + rate history | P3 (single-currency institution) |

### 10. POS

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Point of sale | **ABSENT** — only fine payments (`payments` table via `admin/Fines.tsx`); no till, cash-up, receipts, refunds ledger, Z-report | Full POS: registers, cash-ups, sales invoices, refunds | **BEHIND** | No `pos*` module in `src/**` | Fine receipting ≠ POS | POS module | P2 (only if selling services) |

### 11. Serials

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Subscriptions/prediction/receiving/claims | `serials_subscriptions` (frequency, renewal, cost), `serials_issues` (predicted_date, arrival), fixed-interval prediction (`nextIssueDates`, `generatePredicted`), claims CRUD + tests + `/api/serials/claims` | Publication patterns w/ enumeration/complexity, prediction pattern editor, claims letters, routing | **PARTIAL** | `admin/Serials.tsx` (879 lines), `claims.ts`+test | Koha pattern algorithm far richer; ESUT claims never dispatched to vendors | Pattern engine, claims letters, serial holdings in OPAC | P2 |
| KBART | **Route broken — always HTTP 500** (`requireRole(new Request('http://localhost'))` synthetic request) | KBART via plugins/serials exports | **FAILED (as endpoint)** / PARTIAL (builder) | Live probe: `KBART status=500 "Authentication required."`; `kbart.ts` generator | Endpoint non-functional since creation | Fix auth call to use real request | **P0 quick fix** |
| Routing lists | `serials_routing` table; no UI | Routing list UI | **PARTIAL** | table exists | — | Routing workflow UI | P3 |

### 12. ERM

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Agreements/licenses/packages/coverage/usage | **ABSENT** — `app/api/licenses` returns deposit licences (`ir_licenses`: CC-BY etc.), not e-resource holdings; no agreements/packages/coverage tables | ERM module (agreements, licenses, packages, entitlements, dates, selectors) | **BEHIND** | `20260705120000` seed rows; no `erm_*` tables | Koha's ERM (itself newer) still deeper | ERM model (P2) — but note: subscribed-databases directory now holds the 7 subscribed DBs (static + overlay), which is a catalogue-level stopgap, not ERM | P2: model agreements/coverage if e-resource management is required |

### 13. Notices and Slips

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Notices | `generateNoticeContent` (5 types) + tests + `/api/circulation/notices` — but **zero production callers**; actual email is inline `sendEmail` scattered across 7 pages; no templates UI, no scheduling, no SMS/print slips | Notice queue: templates, transports, scheduled overdue/hold/claim notices, print slips, translations | **BEHIND** | `circulation/notices.ts`+test (0 callers), scattered `sendEmail` calls | Untested end-to-end; no scheduled patron emails | Central notice engine + scheduler | **P1**: wire overdue email job → notices module |
| Branch config/translations | ABSENT | Per-branch notice config | **BEHIND** | — | — | — | P3 |

### 14. ILL

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| ILL | `ill_requests` table + patron form + staff status flip — **owner reports submit is broken** (`issues-to-fix.md` #3); no `/api/ill` route at all (direct supabase insert) | ILL module w/ request lifecycle, statuses, partners, messaging | **BEHIND (broken)** | `ILLRequest.tsx:100` direct insert; no API route | Not functional in production | Make submit work; add statuses/notifications | **P0** (owner-reported) |

### 15. Reporting

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Report generation | `reportWriter.ts`: 5 canned types, PostgREST-only (no SQL — **injection-safe by construction**), CSV/JSON, hard `.limit(1000)`; `/api/admin/reports/generate` has **0 UI callers**; `scheduleMonthly` toggle is local state only; serials branch references nonexistent `end_date` column (runtime error) | SQL report library: saved reports, params, scheduling, permissions, CSV, guide, report catalogue (100s of built-ins) | **BEHIND** (safer but far less capable) | `reportWriter.ts`, `Reports.tsx` | Read-only architecture removes SQLi risk but loses flexibility; canned reports not wired from UI | Fix serials column; wire UI → endpoint; saved-report persistence; scheduler | **P1** |
| Analytics | `/api/admin/analytics` + `Analytics.tsx` live dashboard — **but `analytics_events` insert path (`recordEvent`) has zero callers** and production table is effectively unpopulated (0 loans, empty repo) | Koha statistics module (circulation stats, reports, usage) | **UNVERIFIED** | `eventRecorder.ts` (0 callers); live DB: loans=0 | "Live analytics" advantage not yet substantiated with data | Wire event capture (page/search/checkout events) | **P1** |

### 16. Search / Discovery

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Catalogue search/facets | GIN tsvector FTS (weighted title=A …) + `websearch_to_tsquery`; **client-side facets** (no server aggregations); scoring boosts exact ISBN/DOI | Zebra/Elasticsearch: server facets w/ counts, relevance, spellcheck, MARC browse | **PARTIAL** | `20260927180000_fts_search_vectors.sql`, `localSearch.ts` | Koha's index depth (MARC subfields, facets) much greater; owner reports poor relevance (#4) | Server-side facets, authority browse, MARC field indexing | P1 |
| Federated external sources | **14 in-process adapters** — google_books, open_library, doab, doaj, openalex, crossref, internet_archive, core, gutenberg, standard_ebooks, pubmed, pmc, hathitrust, unpaywall (`adapters.ts:444`); rights classifier + harvest candidates pipeline | Stock OPAC searches catalogue (+ additional contents via plugins); no native 14-source scholarly federation | **AHEAD** | `src/server/resources/adapters.ts`, `sourceRegistry.ts` (14), `/api/search/resources`, 4 adapter test files | Genuinely broader scholarly discovery — **but owner reports production search returns only OpenLibrary results (#4)** → implementation not yet delivering | Fix multi-source ranking/production behavior; make search public (currently `requireUser`) | **P1**: fix before claiming advantage |

### 17. OPAC

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Patron account (renewals, holds, lists, history, suggestions) | Renewals work (`Loans.tsx`); reading lists work; saved items via `GlobalSearch`; **`suggestions` table dead (0 code refs)**; search history ABSENT | Complete OPAC self-service | **PARTIAL** | listed files; `suggestions` unused | Broken hold checkout (#13) undermines core OPAC | Fix #13; implement suggestions or remove table | P0/P2 |
| Ratings/comments | ABSENT | OPAC ratings/comments (sysprefs) | **BEHIND** | — | — | P3 |
| Responsive design | Modern responsive SPA | OPAC responsive themes | **PARITY (concept)** | shadcn/Tailwind UI | ESUT UI newer; **UI modernity is not a functional advantage** | — | — |
| QR digital library card | Present (patron card QR feature) | Patron card + barcode (no QR-first card) | **AHEAD (small)** | barcode/QR features in patron UI | Minor differentiator | — | P3 |

### 18. APIs

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| REST coverage | 82 route files / 102 handlers (24 public, 48 role-guarded, 9 user-guarded) | Large documented REST API (v1) with OpenAPI, OAuth2 client-credentials, webhooks-ish plugins | **PARTIAL** | route inventory (audit) | Breadth decent; **docs/api.md documents only 23 of 82 routes**; no OpenAPI spec; no OAuth2 | Full OpenAPI spec + finish api.md | P1 |
| Auth | Supabase JWT Bearer + CSRF middleware + RBAC | Basic/OAuth2 tokens | **PARITY (concept)** | `requireUser/requireRole` | Both fine; ESUT lacks token-scoped API keys for external apps | API key scoping | P3 |

### 19. Multilingual

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| UI translation | `src/lib/i18n.ts` en/fr ~130 keys — **imported only by its own test**; no switcher, no locale persistence | 40+ languages, translator community, OPAC+staff translations, dated maturity | **BEHIND** | grep: no page imports `@/lib/i18n` | Architecture exists, feature unwired | Wire `t()` into layout + language switcher | P2 (low value for single-language institution) |
| Metadata multilingual | ABSENT | marc880/subject lang support | **BEHIND** | — | — | — | P3 |

### 20. Accessibility

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Accessibility | ~83 `aria-*` attributes; accessibility policy page; **no automated a11y tests (no axe/playwright), no audit doc** | Ongoing accessibility fixes in each release (26.05.x include a11y bugs), semantic TT templates | **PARTIAL** | grep aria; no test config | Both imperfect; neither proven | Add axe + keyboard smoke tests | P2 |

### 21. Plugin / Extension Ecosystem

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Plugins | None — monolith, no plugin loader/hooks | Mature plugin system (Koha 26+ audit-logged API keys, community plugins, installer) | **BEHIND** | no plugin architecture in code | Decades of ecosystem | Not worth building; keep modular server code | NOT APPLICABLE to build (acknowledge gap) |

### 22. Community / Maturity

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Deployments/community | Single institution deployment, ~months old, **production DB effectively empty (12 catalogue items, 2 patrons, 0 loans)**; no test/CI gate (CI = Docker build only) | 1st FOSS ILS, 20+ yrs, thousands of libraries, paid support ecosystem, security release cadence (multiple 2026 security patches) | **BEHIND** | live DB probe; `.github/workflows/docker-build.yml` (no test job) | Existential maturity difference | CI test gate; real data load; operational pilot | **P0**: add test+tsc gates to CI |

### 23. AI

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| AI librarian | `/api/ai/reference-librarian` chat (rate-limited, provider router w/ circuit breaker, 6 agent prompts, ElevenLabs voice) — **prompt-only, no tool calling, no retrieval over catalogue/repository** | No native AI assistant in core (community plugins/experiments only) | **AHEAD (caveated)** | `ai/{brain,providerRouter}.ts` + tests; `AILibrarian.tsx` | Net-new vs Koha — but "catalogue-aware AI" claim is unproven (no RAG/tools); workers reported failing (#19) | Tool calling over catalogue/holds/FAQ; ground in data; fix workers (#19) | P1 |
| Worker agents | 7 job types, DB-backed queue with atomic claim (`claim_agent_jobs`), scheduler, retry/backoff; **owner reports all workers failing (#19)**; scheduler has idempotency bugs | Koha background jobs via cron + plugins | **PARTIAL** | `worker/{index,scheduler,runner}.ts`, agent job tables | Architecture better than cron; reliability unproven | Fix worker failures; add idempotency key | **P0/P1** (owner-reported) |

### 24. Integrated IR / CRIS

| Capability | ESUT | Koha | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| IR + CRIS inside ILS | Repository (communities/collections/items) + CRIS entities (researchers, publications, grants, departments, supervision) + full ILS in **one deployment, one identity layer** | **Koha has no IR and no CRIS** — out of scope by design (not a Koha failure) | **AHEAD (scope)** | `repository_*` tables, `researchers`/`researcher_profiles`/`researcher_grants`, thesis chain | Architectural differentiator for a university library | Unify the two researcher models; link authors jsonb → researchers | P1 |

### Section D — Koha extras check (new gaps)

| Koha capability | ESUT state | Status |
|---|---|---|
| Course reserves | Working `course_reading_lists` flow (lecturer→staff→student) — separate from dead `course_reserves` tables; Koha adds bookings + reservation periods | PARTIAL |
| Bookings/room reservations | ABSENT | BEHIND |
| Stock rotation/rotating collections | ABSENT (Koha job exists) | BEHIND |
| Inventory/stocktaking | ABSENT | BEHIND |
| Label/barcode generation | CODE128 labels (`Barcodes.tsx`, `JsBarcode`), scanner hook — but desk scanning broken (#14); no patron card creator | PARTIAL |
| Patron clubs | Social BookClubs ≠ Koha patron clubs | BEHIND |
| Staged MARC import / modification templates | CSV staging only (see §1) | BEHIND |
| Item transfer workflows | ABSENT | BEHIND |
| Recall functionality | ABSENT | BEHIND |
| Auth providers SAML/OIDC/CAS/LDAP | ABSENT | BEHIND |
| Cash register management | ABSENT | BEHIND |
| Holds policies depth | Basic | BEHIND |

## Summary — Koha

**ESUT is BEHIND Koha in every core ILS depth dimension tested** (cataloguing, acquisitions, circulation maturity, notices, reporting, serials, multilingual, ecosystem). Its genuine advantages over Koha are **scope-based**: an integrated IR + CRIS + AI assistant + federated scholarly discovery in the same platform — none of which Koha attempts. The federated-discovery advantage and AI advantage are currently **weakened by owner-reported production defects** (search returning one source; workers failing) and must be labeled "implemented, not yet proven" until fixed.
