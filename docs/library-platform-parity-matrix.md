# ESUT + AFUED Library Platform — DSpace 10 / Koha 26.05 Feature Parity Matrix

**Generated:** 2026-09-11  
**Codebase:** Shared white-label platform (ESUT + AFUED identical forks, config-differentiated)  
**Benchmark:** DSpace 10.x (IR) + Koha 26.05.x (ILS)

---

## Scoring Legend

- ✅ COMPLETE — implemented, reachable, permission-aware
- 🟡 PARTIAL — exists but incomplete logic/UI/tests
- 🔴 MISSING — no equivalent implementation
- ⚠️ BROKEN — exists but fails or incorrect behavior
- ➖ NOT APPLICABLE — not relevant to this deployment
- 🚀 EXCEEDS — demonstrably stronger than benchmark

---

## 1. CORE DOMAIN MODEL

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Institution/branch structure | Koha org hierarchy | ✅ | ✅ | `institution.config.ts`, faculty/branch config | Low | Complete |
| Bibliographic records | Koha biblio table | ✅ | ✅ | `catalogue_items` table, MARC21 fields | Low | Complete |
| Physical holdings/items | Koha items table | ✅ | ✅ | `catalogue_copies` table, available_copies tracking | Low | Complete |
| Repository digital objects | DSpace item model | ✅ | ✅ | `repository_items`, `repository_collections`, `repository_communities` | Low | Complete |
| Files/bitstreams | DSpace bundle/bitstream | 🟡 | 🟡 | Files in Supabase Storage, no checksum/format metadata | Medium | Add checksum |
| Communities/collections | DSpace hierarchy | 🟡 | 🟡 | Tables exist, no admin CRUD UI | Medium | Add CRUD UI |
| Patron/staff/researcher | Koha borrowers | ✅ | ✅ | `patrons` table, 8 categories, 10 roles | Low | Complete |
| Roles/permissions | Koha permissions | ✅ | ✅ | 10 roles, 17 feature gates, server-side enforcement | Low | Complete |
| Loans/transactions | Koha issues | ✅ | ✅ | `loans`, `circulation_transactions` tables | Low | Complete |
| Fines | Koha account lines | ✅ | ✅ | `fines` table, `calculate_loan_fine()` SQL | Low | Complete |
| Holds/reservations | Koha holds | ✅ | ✅ | `reservations` table, queue + auto-fulfill | Low | Complete |
| Audit trail | DSpace audit | 🟡 | 🟡 | `audit_logs` table + writer; NOT called from circulation | Medium | Wire audit calls |

## 2. CATALOGUING (Koha 4.1)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| MARC21 support | Koha MARC frameworks | ✅ | ✅ | `marc21`, `marc21_fields`, `marc21_leader` columns | Low | Complete |
| Bibliographic record CRUD | Koha cataloguing | ✅ | ✅ | Admin Catalogue pages, CatalogueNew | Low | Complete |
| Item/holdings records | Koha items | ✅ | ✅ | `catalogue_copies` with barcode, call_number | Low | Complete |
| Barcode generation | Koha barcode | ✅ | ✅ | jsbarcode + quagga2 scanner, BarcodeLookup API | Low | Complete |
| Call number/classification | Koha classification | ✅ | ✅ | `call_number` field on catalogue_items | Low | Complete |
| ISBN/ISSN | Koha biblio | ✅ | ✅ | `isbn`, `issn` fields | Low | Complete |
| Subject/keywords | Koha subjects | ✅ | ✅ | `subjects` JSONB field | Low | Complete |
| Cover image | Koha coverimages | ✅ | ✅ | `cover_image_url` field | Low | Complete |
| CSV import | Koha import | ✅ | ✅ | CatalogueImport page, staging batches, validation | Low | Complete |
| Staged import with matching | Koha staged imports | ✅ | ✅ | `catalogue_staging_batches` + `staging_rows` | Low | Complete |
| Export MARC/MARCXML | Koha export | 🟡 | 🟡 | Client-side XML build, no server export job | Low | Sufficient |
| Authority control | Koha authorities | 🔴 | 🔴 | No authority records, no authority-linked cataloguing | High | P2 |
| Z39.50/SRU client | Koha Z39.50 | 🔴 | 🔴 | External adapter pattern exists but no Z39.50 | High | P2 |
| Batch item modification | Koha batch modify | 🔴 | 🔴 | No batch edit UI for existing records | Medium | P2 |
| Inventory/stocktaking | Koha inventory | 🔴 | 🔴 | No inventory feature | Medium | P2 |
| Label/barcode generation | Koha labels | 🟡 | 🟡 | Barcode generation exists; no spine label printing | Low | P3 |
| Duplicate detection | Koha duplicate | 🟡 | 🟡 | ISBN matching in import validation only | Medium | P2 |

## 3. CIRCULATION (Koha 5.1)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Staff checkout | Koha checkout | ✅ | ✅ | Circulation.tsx checkout tab, copy tracking | Low | Complete |
| Staff check-in | Koha checkin | ✅ | ✅ | Circulation.tsx check-in tab, fine + hold fulfillment | Low | Complete |
| Due date calculation | Koha duedate | ✅ | ✅ | Category-based from `institutionConfig.loanRules` | Low | Complete |
| Overdue fine calculation | Koha fines | ✅ | ✅ | `calculate_loan_fine()` SQL, grace days, max amount, exam suspension | Low | Complete |
| Patron self-renewal | Koha OPAC renewal | ⚠️ | ⚠️ | **BUG:** Always adds 14 days, ignores category duration | HIGH | **P0 FIX** |
| Staff renewal | Koha circ/renew | 🔴 | 🔴 | No staff-initiated renewal button | Medium | P1 |
| Max items enforcement | Koha maxreserve | ⚠️ | ⚠️ | **BUG:** `maxItems` from loanRules never checked at checkout | HIGH | **P0 FIX** |
| Hold queue | Koha holds | ✅ | ✅ | Priority ordering, auto-fulfillment on return | Low | Complete |
| Hold expiry | Koha reserves_auto_acquire | ✅ | ✅ | Auto-expired in create/process RPCs | Low | Complete |
| Recall | Koha recall | 🔴 | 🔴 | No recall functionality | Medium | P2 |
| Transfer | Koha transfer | ➖ | ➖ | Single-library mode, N/A | N/A | N/A |
| Offline circulation | Koha offline | 🟡 | 🟡 | Offline checkout queuing only, no check-in, no conflict detection | Medium | P2 |
| Fine payment | Koha pays/writeoffs | 🔴 | 🔴 | Fines created but no payment/recording UI | HIGH | **P1** |
| Exam period fine suspension | Koha suspensions | ✅ | ✅ | `fines_suspended` flag, `isExamPeriod()` check | Low | Complete |
| Circulation rules engine | Koha circ rules | ✅ | ✅ | `get_circulation_rules()` SQL, configurable via `app_settings` | Low | Complete |
| Audit trail for circulation | Koha action logs | ⚠️ | ⚠️ | `writeAuditLog()` exists but NOT called from circulation | Medium | P1 |
| Overdue emails | Koha notif. | ⚠️ | ⚠️ | Templates exist but NO automated trigger | HIGH | **P1** |

## 4. PATRON MANAGEMENT (Koha 6)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Patron directory | Koha members | ✅ | ✅ | Patrons.tsx, search/filter/paginate | Low | Complete |
| Patron categories | Koha categories | ✅ | ✅ | 8 categories with loan rules | Low | Complete |
| Registration approval | Koha member entry | ✅ | ✅ | 3 policy modes, Approvals queue | Low | Complete |
| Account expiry | Koha password expiry | ✅ | ✅ | `membership_expires_at` throughout | Low | Complete |
| Status management | Koha flags | ✅ | ✅ | 8 statuses, status change with clearance | Low | Complete |
| CSV import | Koha import | ✅ | ✅ | Full CSV import workflow with validation | Low | Complete |
| Digital library card | Koha OPAC | 🚀 | 🚀 | QR code, PNG export, PDF export — exceeds Koha | Low | Complete |
| General patron self-edit | Koha OPAC | 🔴 | 🔴 | Account.tsx is read-only, only researchers can edit | Medium | **P1** |
| Patron notes | Koha borrowernotes | 🔴 | 🔴 | No internal notes field on patrons | Medium | P2 |
| Suspend account | Koha flags | ⚠️ | ⚠️ | Button exists but NO onClick handler | HIGH | **P1 FIX** |
| Renew membership | Koha renew | ⚠️ | ⚠️ | Button exists but NO onClick handler | HIGH | **P1 FIX** |
| Anonymization | Koha anonymise | 🔴 | 🔴 | Privacy policy mentions it, no code | Medium | P2 |
| Duplicate detection | Koha duplicate | 🟡 | 🟡 | Email uniqueness only, no name/matric dedup | Low | P2 |
| Patron image | Koha image | 🔴 | 🔴 | Profile photo on researcher profiles only | Low | P3 |
| Reading history | Koha OPAC | 🔴 | 🔴 | Only physical loan history, no digital access tracking | Low | P3 |
| Export patron data | Koha export | ✅ | ✅ | CSV export in Patrons.tsx | Low | Complete |

## 5. OPAC / PUBLIC DISCOVERY (Koha 7)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Simple search | Koha OPAC search | ✅ | ✅ | GlobalSearch page, resource search API | Low | Complete |
| Advanced search | Koha extended | 🟡 | 🟡 | Fielded search via adapters, no dedicated advanced UI | Medium | P2 |
| Full-text search | DSpace fulltext | 🟡 | 🟡 | Local search + external adapters; no FTS on DB content | Medium | P2 |
| Facets/filters | Koha facets | ✅ | ✅ | Category, faculty, type, status filters in catalogue | Low | Complete |
| Sorting | Koha sorting | ✅ | ✅ | Sort by title, author, date, relevance | Low | Complete |
| Record detail | Koha/DSpace | ✅ | ✅ | CatalogueItem.tsx with metadata, availability, copies | Low | Complete |
| Cover images | Koha coverimages | ✅ | ✅ | `cover_image_url` displayed | Low | Complete |
| Patron self-service login | Koha OPAC | ✅ | ✅ | Login, profile, loans, holds, fines display | Low | Complete |
| Renew online | Koha OPAC | ⚠️ | ⚠️ | Exists but hardcoded 14-day bug | HIGH | P0 |
| Hold/cancel holds | Koha OPAC | ✅ | ✅ | Reserve/borrow/return via CatalogueItem.tsx | Low | Complete |
| Fines display | Koha OPAC | ✅ | ✅ | Fines shown in Loans.tsx + Account.tsx | Low | Complete |
| Lists/favorites | Koha lists | 🟡 | 🟡 | Reading lists exist, no public lists feature | Low | P3 |
| Citation export | DSpace export | 🟡 | 🟡 | 4 citation styles in RepositoryItem only, not catalogue | Low | P2 |
| Purchase suggestions | Koha suggestions | 🟡 | 🟡 | `purchase_recommendations` table, no patron UI | Medium | P2 |

## 6. ACQUISITIONS (Koha 8)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Vendors | Koha vendors | 🟡 | 🟡 | `acquisition_suppliers` table, admin Acquisitions page | Medium | P2 |
| Budgets/funds | Koha budget | 🟡 | 🟡 | `acquisition_budgets` table exists | Medium | P2 |
| Purchase suggestions | Koha suggestions | 🟡 | 🟡 | Table exists, no workflow UI | Medium | P2 |
| Orders/baskets | Koha baskets | 🔴 | 🔴 | No order management UI | Medium | P2 |
| Receiving | Koha receiving | 🔴 | 🔴 | No receiving workflow | Medium | P2 |
| Invoices | Koha invoices | 🔴 | 🔴 | No invoice management | Medium | P2 |

## 7. SERIALS (Koha 9)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Subscriptions | Koha serial | 🟡 | 🟡 | `serials_subscriptions` table, admin Serials page | Medium | P2 |
| Issue receiving | Koha serial | 🟡 | 🟡 | `serials_issues` table | Medium | P2 |
| Routing lists | Koha routing | 🟡 | 🟡 | `serials_routing` table | Medium | P2 |

## 8. INTERLIBRARY LOAN (Koha 11)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| ILL requests | Koha ILL | ✅ | ✅ | `ill_requests` table, ILLRequest page, ILLHistory, admin ILL | Low | Complete |
| Workflow statuses | Koha ILL | 🟡 | 🟡 | Status field but limited state machine | Medium | P2 |
| Document delivery | Koha ILL | 🔴 | 🔴 | No document delivery feature | Low | P3 |

## 9. COURSE RESERVES (Koha 12)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Course reserve items | Koha course reserves | ✅ | ✅ | `course_reserves`, `course_reserve_items` tables | Low | Complete |
| Reading lists | Koha | ✅ | ✅ | `course_reading_lists`, `course_reading_list_items` | Low | Complete |
| Searchable course page | Koha | ✅ | ✅ | CourseReserves public page | Low | Complete |

## 10. DIGITAL REPOSITORY (DSpace 10)

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Communities | DSpace communities | 🟡 | 🟡 | Tables exist, public read, no admin CRUD | Medium | **P1** |
| Collections | DSpace collections | 🟡 | 🟡 | Tables exist, public read, no admin CRUD | Medium | **P1** |
| Items with metadata | DSpace items | ✅ | ✅ | Full metadata, Dublin Core mapping | Low | Complete |
| File upload | DSpace bitstream | ✅ | ✅ | PDF upload to Supabase Storage | Low | Complete |
| Submission workflow | DSpace submission | ✅ | ✅ | Submit → Review → Approve/Reject → Publish | Low | Complete |
| Embargo | DSpace embargo | ✅ | ✅ | `embargo_until` field, 6/12/24 month options | Low | Complete |
| Versioning | DSpace versioning | 🟡 | 🟡 | Display only, no manual version upload | Medium | P2 |
| Withdraw/reinstate | DSpace withdraw | 🔴 | 🔴 | No item lifecycle management | Medium | **P1** |
| Access policies | DSpace policies | 🟡 | 🟡 | Visibility field (Open/Members/Private) but no group-level | Low | P2 |
| OAI-PMH | DSpace OAI | ✅ | ✅ | Complete endpoint (265 lines), oai_dc + oai_marc | Low | Complete |
| DOI minting | DSpace DOI | ✅ | ✅ | Zenodo integration, auto-mint on publish | Low | Complete |
| ORCID | DSpace ORCID | ✅ | ✅ | ORCID validation + links in submissions | Low | Complete |
| Statistics | DSpace stats | ✅ | ✅ | RepositoryStats with charts, top downloads/views | Low | Complete |
| Citation export | DSpace citation | ✅ | ✅ | APA, Harvard, MLA, Chicago styles | Low | Complete |
| Reviews/annotations | DSpace (advanced) | 🚀 | 🚀 | Star ratings + threaded comments + annotations — exceeds | Low | Complete |
| Dublin Core export | DSpace DC | ✅ | ✅ | Client-side DC XML + MARC21 XML export | Low | Complete |
| Configurable entities | DSpace entities | 🔴 | 🔴 | No configurable entity model beyond fixed schema | High | P3 |
| Preservation/AIP | DSpace AIP | 🔴 | 🔴 | No METS/AIP packaging | High | P3 |

## 11. REPORTING & ANALYTICS

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Operational dashboard | Koha reports | 🟡 | 🟡 | Admin dashboard with aggregate counts | Low | P2 |
| Circulation reports | Koha reports | 🔴 | 🔴 | Placeholder only — "connect BI tool" | Medium | **P1** |
| Collection reports | Koha reports | 🟡 | 🟡 | NUC compliance tab has some stats | Low | P2 |
| Report engine | Koha reports | 🔴 | 🔴 | No saved reports, no parameters, no export | Medium | P2 |
| Search analytics | DSpace stats | 🟡 | 🟡 | Analytics page exists, limited data | Low | P2 |

## 12. NOTIFICATIONS

| Capability | Benchmark | ESUT | AFUED | Evidence | Risk | Decision |
|---|---|---|---|---|---|---|
| Email templates | Koha/DSpace | ✅ | ✅ | 10+ HTML templates (circulation, ILL, thesis, etc.) | Low | Complete |
| Automated send | Koha triggers | ⚠️ | ⚠️ | Templates exist but NO automated dispatch | HIGH | **P1** |
| Push notifications | DSpace | ✅ | ✅ | VAPID push via `send-push` edge function | Low | Complete |
| In-app notifications | Koha | ✅ | ✅ | `notifications` + `user_notifications` tables, bell UI | Low | Complete |
| Notification preferences | Koha | 🔴 | 🔴 | No per-user notification preferences | Low | P2 |

## 13. SECURITY

| Capability | Benchmark | ASVS 5.0 | ESUT | AFUED | Evidence |
|---|---|---|---|---|---|
| Authentication | Koha auth | Required | ✅ | ✅ | Supabase Auth, JWT, password reset |
| Authorization (RBAC) | Koha permissions | Required | ✅ | ✅ | 10 roles, server-side enforcement, RLS |
| CSRF | OWASP | Required | ✅ | ✅ | Cookie+header token validation |
| Rate limiting | ASVS | Required | ✅ | ✅ | Arcjet + in-memory dev limiter |
| CSP | ASVS | Required | ✅ | ✅ | Full CSP in middleware |
| Input validation | ASVS | Required | ✅ | ✅ | Zod schemas, parameterized queries |
| Audit logging | DSpace audit | Required | 🟡 | 🟡 | Infrastructure exists, not wired to all operations |
| SQL injection | OWASP | Required | ✅ | ✅ | Supabase client parameterization |
| XSS | OWASP | Required | ✅ | ✅ | CSP + React escaping + XML escaping |
| PII protection | GDPR/NDPR | Required | 🟡 | 🟡 | PII redaction in logs, but no anonymization |
| File upload security | ASVS | Required | ✅ | ✅ | Type validation, size limits, Supabase Storage RLS |

## 14. REPORTING SCORES

### ESUT Module Scores

| Module | Total | Complete | Partial | Missing | Score | Weighted |
|---|---|---|---|---|---|---|
| Core Domain | 8 | 6 | 2 | 0 | 87.5% | 87.5% |
| Cataloguing | 14 | 10 | 3 | 1 | 82.1% | 78.6% |
| Circulation | 17 | 9 | 5 | 3 | 64.7% | 58.8% |
| Patron Mgmt | 16 | 9 | 2 | 5 | 62.5% | 56.3% |
| OPAC | 15 | 9 | 4 | 2 | 70.0% | 63.3% |
| Acquisitions | 6 | 0 | 3 | 3 | 25.0% | 25.0% |
| Serials | 3 | 0 | 3 | 0 | 50.0% | 50.0% |
| ILL | 3 | 1 | 1 | 1 | 50.0% | 50.0% |
| Course Reserves | 3 | 3 | 0 | 0 | 100% | 100% |
| Repository/IR | 16 | 10 | 4 | 2 | 75.0% | 68.8% |
| Reports | 5 | 0 | 3 | 2 | 30.0% | 30.0% |
| Notifications | 5 | 3 | 1 | 1 | 70.0% | 70.0% |
| Security | 11 | 9 | 2 | 0 | 90.9% | 90.9% |
| **OVERALL** | **122** | **69** | **32** | **21** | **68.2%** | **64.8%** |

### Criticality-Weighted Score

Core circulation (P0): 58.8% → **NEEDS IMMEDIATE FIX**  
Security: 90.9% → Good  
Repository: 68.8% → Adequate with gaps  

---

## PRIORITY CLASSIFICATION

### P0 — CORRECTNESS / SECURITY / DATA-LOSS (Fix Immediately)

1. **Renewal duration bug** — Always 14 days regardless of patron category
2. **Max items not enforced** — No checkout limit per patron category
3. **Types out of sync** — `reservations` TS types missing 5 columns from latest migration

### P1 — CORE LIBRARY OPERATION (Fix This Sprint)

4. **No automated email dispatch** — Templates exist but nothing sends them
5. **Fine payment recording** — Fines created but never collected/managed
6. **Dead Suspend/Renew buttons** — UI exists but no click handlers
7. **Patron profile self-edit** — Only researchers can edit profile
8. **Community/Collection admin CRUD** — Tables exist, no management UI
9. **Item withdraw/reinstate** — Missing IR lifecycle feature
10. **Circulation audit logging** — `writeAuditLog()` exists but not called
11. **Circulation reports** — Placeholder only

### P2 — MATURE ILS/REPOSITORY CAPABILITY (Next Sprint)

12. Authority control
13. Z39.50/SRU client
14. Batch item modification
15. Inventory/stocktaking
16. Advanced search UI
17. Recall
18. Offline circulation improvements
19. Patron notes
20. Version upload workflow
21. Group-level access policies
22. Report engine with parameters
23. Notification preferences
24. Data anonymization
25. Purchase suggestion workflow

### P3 — ADVANCED INTEROPERABILITY (Backlog)

26. Configurable entity model
27. Preservation/AIP/METS packaging
28. IIIF
29. SWORD
30. ERM
31. Patron image
32. Reading history (digital)
33. Label/spine printing
