# Complete Feature Inventory — ESUT Smart Library

Date: 2026-09-30 · Commit: `dacbeed` · Audit: evidence-based, verified against current codebase

## Status Model

| Status | Meaning |
|---|---|
| COMPLETE | Works end-to-end including required backend/runtime. UI exists where required. Tests exist. |
| PARTIAL | Meaningful implementation exists but one or more required runtime/UI/integration components missing. |
| BACKEND_ONLY | Backend/service/API/schema exists but users cannot use it through application UI. |
| UI_ONLY | UI exists but real backend/runtime implementation is absent, mocked or disconnected. |
| SCHEMA_ONLY | Database tables/columns exist but functional service/runtime behavior not implemented. |
| MOCKED | Feature uses fake/demo/static/fixture behavior where production behavior expected. |
| BROKEN | Feature is intended to work but currently fails. |
| BLOCKED_EXTERNAL | Internal implementation complete but external credentials/vendor/hardware prevents activation. |
| NOT_IMPLEMENTED | No meaningful implementation exists. |
| NOT_APPLICABLE | Intentionally not relevant. |

## Maturity Levels (standards/integration)

| Level | Meaning |
|---|---|
| 0 | name/UI/demo only |
| 1 | code exists |
| 2 | automated tests pass |
| 3 | working runtime locally/staging |
| 4 | deployed |
| 5 | independently interoperated with external implementation |

---

## A. PUBLIC / USER-FACING PLATFORM

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Homepage | COMPLETE | `src/app-pages/Home.tsx` | Hero, stats, navigation, responsive | No personalization | — | Dynamic content |
| Global search | PARTIAL | `src/app-pages/GlobalSearch.tsx`, `app/api/search/resources/route.ts` | Local + federated search | No server-side facets | — | Facets, ranking |
| Catalogue browse | PARTIAL | `src/app-pages/Catalogue.tsx`, `app/api/catalog/route.ts` | Search, filters, detail | No facet counts | — | Faceted search |
| Repository browse | PARTIAL | `src/app-pages/Repository.tsx`, `app/api/repository/route.ts` | Listing, detail, files array | No multi-file upload UI | — | Multi-file UI |
| Research discovery | PARTIAL | `src/app-pages/Researchers.tsx`, `researcher_profiles` | Researcher profiles, grants | No CRIS relationships | — | Full CRIS |
| User account | PARTIAL | `src/app-pages/dashboard/*` | Dashboard, loans, holds | No self-service profile edit | — | Profile editing |
| QR digital library card | PARTIAL | `src/app-pages/dashboard/LibraryCard.tsx` | QR generation, PNG/PDF export | No scanning integration | barcodeUtils.test.ts | Staff verification |
| Blog | PARTIAL | `src/app-pages/Blog.tsx`, `BlogPost.tsx` | Listing, detail, RSS | No comments UI | — | Comments, search |
| Events | COMPLETE | `src/app-pages/Events.tsx`, `EventDetails.tsx` | Calendar, filtering, registration | No reminders | — | ICS export |
| Forum/Community | PARTIAL | `src/app-pages/Community.tsx`, `Feed.tsx` | Feed, posting, Discourse SSO | No built-in topics/replies | — | Full forum |
| CMS content | COMPLETE | `src/app-pages/CmsPage.tsx`, `cms_pages` table | Pages, banners, menu | No version history | — | Versioning |
| Wellbeing/resources | COMPLETE | `src/app-pages/Wellbeing.tsx` | Resources, study break, AI companion | No analytics | — | Analytics |
| Notifications | PARTIAL | `src/hooks/useNotifications.ts`, `NotificationBell.tsx` | In-app, push, email | No preferences | — | Preferences |
| Responsive/mobile | PARTIAL | Tailwind responsive classes | Responsive layout | No touch optimization | — | Touch, PWA install |
| Accessibility | PARTIAL | ~83 aria attributes, shadcn/ui | Basic a11y | No automated tests, no WCAG target | — | Automated tests |
| Multilingual | NOT_IMPLEMENTED | `src/lib/i18n.ts` (0 callers) | en/fr strings exist | No switcher, no wired i18n | i18n.test.ts | Wire i18n |

## B. AUTHENTICATION / USERS / SECURITY

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Sign up | COMPLETE | `src/app-pages/Register.tsx`, `/api/registration/*` | Email verification, policy | — | — | — |
| Login | COMPLETE | `src/app-pages/Login.tsx` | Supabase auth, lockout | — | — | — |
| Password reset | COMPLETE | `src/app-pages/ForgotPassword.tsx` | Reset flow | — | — | — |
| Email verification | COMPLETE | `/api/registration/verify/route.ts` | Token verification | — | — | — |
| Session handling | COMPLETE | Supabase JWT | Token-based sessions | — | — | — |
| RBAC | PARTIAL | `src/server/auth/permissions.ts`, `requireRole` | 10 roles, feature flags | Role model drift | permissions.test.ts | Consolidation |
| RLS | PARTIAL | 125/125 tables RLS-enabled | All tables protected | Some permissive policies | — | Tighten policies |
| SSO/OIDC/SAML/LDAP | NOT_IMPLEMENTED | — | — | — | — | — |
| Audit logging | PARTIAL | `src/server/audit/writeAuditLog.ts` | Admin action logging | No request IDs | — | Request tracing |
| Rate limiting | PARTIAL | `src/server/rate-limit.ts` | In-memory limiter | Per-instance only | — | Distributed |
| Security headers | PARTIAL | `middleware.ts` | CSRF, sensitive prefixes | Not comprehensive | — | Full headers |

## C. PATRON MANAGEMENT

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Patron registration | COMPLETE | `src/app-pages/Register.tsx` | Full flow with verification | — | — | — |
| Patron categories | PARTIAL | `patrons.patron_category` | Category field | No category management UI | — | Category UI |
| Profile management | PARTIAL | `src/app-pages/dashboard/Profile.tsx` | View profile | No self-service edit | — | Edit UI |
| Patron search | PARTIAL | `src/app-pages/admin/Patrons.tsx` | Search, filter | — | — | — |
| Patron history | PARTIAL | `loans` table | Loan history | No dedicated history API | — | History API |
| Borrowing eligibility | PARTIAL | `patrons.status` | Status check | No restriction rules engine | — | Rules engine |
| Restrictions | NOT_IMPLEMENTED | — | — | — | — | — |
| Expiration | PARTIAL | `patrons.membership_expires_at` | Field exists | No expiration enforcement job | — | Enforcement |
| Fines/account balance | SCHEMA_ONLY | `fines`, `payments` tables | Schema exists | No payment processing | — | Payment UI |
| Guarantor relationships | NOT_IMPLEMENTED | — | — | — | — | — |
| Imports/exports | NOT_IMPLEMENTED | — | — | — | — | — |
| QR/card generation | PARTIAL | `LibraryCard.tsx` | QR generation | No scanning integration | barcodeUtils.test.ts | Staff verification |

## D. CATALOGUE / OPAC

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Bibliographic records | PARTIAL | `catalogue_items` table | MARC21 JSONB | No full MARC editor | — | MARC editor |
| Item/copy records | PARTIAL | `catalogue_copies` table | Copies with barcode | No copy management UI | — | Copy UI |
| Holdings | PARTIAL | `catalogue_items.total_copies` | Availability tracking | No holdings statement | — | Holdings display |
| Catalogue search | PARTIAL | `app/api/catalog/route.ts` | FTS with weights | No server-side facets | — | Facets |
| Filters/facets | PARTIAL | `src/app-pages/Catalogue.tsx` | Client-side filters | No facet counts | — | Server facets |
| Record detail | PARTIAL | `src/app-pages/CatalogueItem.tsx` | Detail view | — | — | — |
| ISBN/ISSN | PARTIAL | `catalogue_items.isbn` | Field exists | No validation | — | Validation |
| Call number | PARTIAL | `catalogue_items.call_number` | Field exists | — | — | — |
| Subjects/authors | PARTIAL | `catalogue_items.subjects` | JSONB fields | No authority linking | — | Authority link |
| Classification | NOT_IMPLEMENTED | — | — | — | — | — |
| Branch/library support | PARTIAL | `catalogue_copies.branch` | Branch field | No multi-branch UI | — | Branch UI |
| Cover images | PARTIAL | `catalogue_items.cover_image` | Field exists | No cover service | — | Cover service |
| Lists/favorites | PARTIAL | `patron_saved_items` table | Save items | No lists UI | — | Lists UI |
| Saved search | NOT_IMPLEMENTED | — | — | — | — | — |
| Recommendations | NOT_IMPLEMENTED | — | — | — | — | — |

## E. MARC CATALOGUING

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| MARC21 | PARTIAL | `src/server/catalogue/marc.ts` | JSONB→XML/JSON | No MARCXML import | marc.test.ts | MARCXML import |
| MARCXML | PARTIAL | `src/server/catalogue/marcXml.ts` | Export + parse | No round-trip test | — | Round-trip |
| Leader | PARTIAL | `catalogue_items.marc21_leader` | Field exists | No leader editing | — | Leader editing |
| Control fields | PARTIAL | `catalogue_items.marc21_fields` | JSONB storage | No control field editing | — | Control field UI |
| Indicators/subfields | PARTIAL | `marc21_fields` JSONB | Stored | No editing UI | — | Editing UI |
| Repeated fields | PARTIAL | JSONB array | Supported | No UI | — | UI |
| Import | PARTIAL | `src/server/catalogue/stageImport.ts` | CSV staging | No MARCXML import | importValidation.test.ts | MARCXML import |
| Export | PARTIAL | `marcToXml()` | MARCXML generation | — | — | — |
| Validation | PARTIAL | `validateMARCXML()` | Basic validation | No full validation | — | Full validation |
| MARC frameworks | NOT_IMPLEMENTED | — | — | — | — | — |
| Staged import | PARTIAL | `catalogue_staging` table | CSV staging | No MARC staging | — | MARC staging |
| Duplicate detection | PARTIAL | `src/server/catalogue/duplicates.ts` | ISBN/title detection | No merge | duplicates.test.ts | Merge |
| Overlay rules | NOT_IMPLEMENTED | — | — | — | — | — |
| Protected local fields | NOT_IMPLEMENTED | — | — | — | — | — |
| Batch modification | NOT_IMPLEMENTED | — | — | — | — | — |

## F. AUTHORITY CONTROL

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Authority records | SCHEMA_ONLY | `authority_control` table | Table exists | No CRUD | — | Full module |
| Authority types | SCHEMA_ONLY | `authority_control.term_type` | Field exists | No type management | — | Type management |
| Preferred headings | NOT_IMPLEMENTED | — | — | — | — | — |
| Variants | NOT_IMPLEMENTED | — | — | — | — | — |
| See/see-also | NOT_IMPLEMENTED | — | — | — | — | — |
| Bibliographic linkage | SCHEMA_ONLY | `catalogue_items.authority_id` | Column exists | No linking logic | — | Linking |
| Autocomplete | NOT_IMPLEMENTED | — | — | — | — | — |
| Relinking | NOT_IMPLEMENTED | — | — | — | — | — |
| Authority merge | NOT_IMPLEMENTED | — | — | — | — | — |
| External lookup (VIAF/LC) | NOT_IMPLEMENTED | — | — | — | — | — |
| ORCID | PARTIAL | `app/api/orcid/route.ts` | Lookup proxy | No OAuth/sync | — | OAuth |
| ISNI | NOT_IMPLEMENTED | — | — | — | — | — |
| ROR | PARTIAL | `src/server/interoperability/ror.ts` | Lookup proxy | 0 UI callers | ror.test.ts | UI integration |

## G. CIRCULATION

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Checkout | PARTIAL | `src/app-pages/admin/Circulation.tsx` | UI exists | Owner reports broken (#13/#14 fixed) | — | — |
| Check-in | PARTIAL | `Circulation.tsx` | UI exists | — | — | — |
| Renewals | PARTIAL | `src/app-pages/dashboard/Loans.tsx` | UI exists | — | — | — |
| Due dates | PARTIAL | `loans.due_date` | Field exists | No calendar | — | Calendar |
| Overdue handling | PARTIAL | `loans.status` | Status tracking | No overdue job | — | Overdue job |
| Holds/reservations | PARTIAL | `reservations` table | Schema + UI | No hold queue UI | — | Hold queue |
| Hold queue | PARTIAL | `Circulation.tsx` | Queue display | No checkout action | — | Hold checkout |
| Recalls | NOT_IMPLEMENTED | — | — | — | — | — |
| Item status | PARTIAL | `catalogue_copies.status` | Field exists | No status UI | — | Status UI |
| Circulation history | PARTIAL | `circulation_transactions` table | Table exists | No history API | — | History API |
| Branch handling | PARTIAL | `catalogue_copies.branch` | Field exists | No branch UI | — | Branch UI |
| Transfers | NOT_IMPLEMENTED | — | — | — | — | — |
| Circulation rules | PARTIAL | `institution.config.ts` | Hard-coded rules | No DB rules | — | DB rules |
| Fines | SCHEMA_ONLY | `fines` table | Schema exists | No fine UI | — | Fine UI |
| Fees | SCHEMA_ONLY | `payments` table | Schema exists | No payment processing | — | Payment UI |
| Lost items | NOT_IMPLEMENTED | — | — | — | — | — |
| Barcode scanning | PARTIAL | `src/features/barcode/useBarcodeScanner.ts` | Scanner exists | Not integrated in circulation | barcodeUtils.test.ts | Integration |
| Offline circulation | PARTIAL | `app/api/circulation/offline-sync/route.ts` | Route exists | 0 UI callers | — | UI wiring |

## H. SIP2 / SELF SERVICE

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| SIP2 parser | PARTIAL | `src/server/sip2/messages.ts` | Message parsing | — | sip2.test.ts | — |
| Authentication | PARTIAL | `src/server/sip2/auth.ts` | bcrypt auth, rate limiting | No TCP listener | auth.test.ts | TCP listener |
| Terminal configuration | PARTIAL | `sip2_terminals` table | Schema exists | No config UI | — | Config UI |
| Operation permissions | PARTIAL | `isOperationAllowed()` | Permission check | — | auth.test.ts | — |
| TCP listener | NOT_IMPLEMENTED | — | — | — | — | — |
| Checkout | PARTIAL | `server.ts` | Writes to circulation_transactions | — | — | — |
| Check-in | NOT_IMPLEMENTED | — | — | — | — | — |
| Patron info | PARTIAL | `server.ts` | Returns "OK" | No real patron data | — | Real data |
| Item info | NOT_IMPLEMENTED | — | — | — | — | — |
| Renewal | NOT_IMPLEMENTED | — | — | — | — | — |
| External SIP client testing | NOT_IMPLEMENTED | — | — | — | — | — |
| Production hardware validation | NOT_IMPLEMENTED | — | — | — | — | — |

## I. ILL

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Patron ILL request | PARTIAL | `src/app-pages/ILLRequest.tsx`, `app/api/ill/route.ts` | API route exists | — | — | — |
| Staff processing | PARTIAL | `src/app-pages/admin/ILL.tsx` | UI exists | — | — | — |
| Statuses | PARTIAL | `ill_requests.status` | Status field | No workflow | — | Workflow |
| Lender/provider fields | PARTIAL | `ill_requests.lending_institution` | Field exists | No provider management | — | Provider mgmt |
| Communications | NOT_IMPLEMENTED | — | — | — | — | — |
| Approval | NOT_IMPLEMENTED | — | — | — | — | — |
| Completion | NOT_IMPLEMENTED | — | — | — | — | — |
| Cancellation | NOT_IMPLEMENTED | — | — | — | — | — |
| External integrations | NOT_IMPLEMENTED | — | — | — | — | — |

## J. ACQUISITIONS

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Suppliers/vendors | PARTIAL | `acquisition_suppliers` table, `src/app-pages/admin/Acquisitions.tsx` | CRUD UI | — | — | — |
| Budgets | PARTIAL | `acquisition_budgets` table | Schema exists | No encumbrance | — | Encumbrance |
| Funds | NOT_IMPLEMENTED | — | — | — | — | — |
| Fiscal years | NOT_IMPLEMENTED | — | — | — | — | — |
| Purchase suggestions | PARTIAL | `purchase_recommendations` table | Schema exists | No UI | — | UI |
| Purchase orders | PARTIAL | `purchase_orders` table, UI | CRUD UI | No receiving workflow | — | Receiving |
| Order lines | PARTIAL | `purchase_order_items` table | Schema exists | No line receiving | — | Line receiving |
| Receiving | NOT_IMPLEMENTED | — | — | — | — | — |
| Partial receiving | NOT_IMPLEMENTED | — | — | — | — | — |
| Invoices | PARTIAL | `supplier_invoices` table | Schema exists | No invoice UI | — | Invoice UI |
| Credits | NOT_IMPLEMENTED | — | — | — | — | — |
| Cancellations | NOT_IMPLEMENTED | — | — | — | — | — |
| Claims | NOT_IMPLEMENTED | — | — | — | — | — |
| Encumbrance | NOT_IMPLEMENTED | — | — | — | — | — |
| Expenditure | NOT_IMPLEMENTED | — | — | — | — | — |
| Shipping | NOT_IMPLEMENTED | — | — | — | — | — |
| Taxes | NOT_IMPLEMENTED | — | — | — | — | — |
| Multi-currency | NOT_IMPLEMENTED | — | — | — | — | — |

## K. EDI / EDIFACT

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Message format | BACKEND_ONLY | `src/server/acquisitions/edi.ts` | X12 850 generation | No EDIFACT | edi.test.ts | EDIFACT |
| Vendor configuration | NOT_IMPLEMENTED | — | — | — | — | — |
| Orders | BACKEND_ONLY | `generateEdi850Async()` | X12 generation | No real supplier | — | Real supplier |
| Acknowledgements | NOT_IMPLEMENTED | — | — | — | — | — |
| Invoices | NOT_IMPLEMENTED | — | — | — | — | — |
| Claims | NOT_IMPLEMENTED | — | — | — | — | — |
| Real supplier integration | NOT_IMPLEMENTED | — | — | — | — | — |
| External validation | NOT_IMPLEMENTED | — | — | — | — | — |

## L. POS / PAYMENTS

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Fine payment | SCHEMA_ONLY | `payments` table | Schema exists | No payment UI | — | Payment UI |
| Fees | SCHEMA_ONLY | `fines` table | Schema exists | No fee UI | — | Fee UI |
| Waivers | NOT_IMPLEMENTED | — | — | — | — | — |
| Refunds | NOT_IMPLEMENTED | — | — | — | — | — |
| Receipts | NOT_IMPLEMENTED | — | — | — | — | — |
| Payment provider | NOT_IMPLEMENTED | — | — | — | — | — |
| Cash register | NOT_IMPLEMENTED | — | — | — | — | — |
| Reconciliation | NOT_IMPLEMENTED | — | — | — | — | — |
| Audit trail | SCHEMA_ONLY | `payments` table | Schema exists | No audit logic | — | Audit logic |

## M. SERIALS

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Subscriptions | PARTIAL | `serials_subscriptions` table, UI | CRUD UI | — | — | — |
| Issue prediction | PARTIAL | `serials_issues.predicted_date` | Field exists | No prediction algorithm | — | Algorithm |
| Frequencies | PARTIAL | `serials_subscriptions.frequency` | Field exists | — | — | — |
| Expected issues | PARTIAL | `serials_issues` table | Schema exists | No receiving UI | — | Receiving UI |
| Issue receiving | NOT_IMPLEMENTED | — | — | — | — | — |
| Late issues | NOT_IMPLEMENTED | — | — | — | — | — |
| Missing issues | NOT_IMPLEMENTED | — | — | — | — | — |
| Claims | PARTIAL | `serials_claims` table, `src/server/serials/claims.ts` | CRUD exists | No claim sending | claims.test.ts | Sending |
| Renewal | NOT_IMPLEMENTED | — | — | — | — | — |
| Vendor link | PARTIAL | `serials_subscriptions.supplier_id` | Field exists | — | — | — |
| Routing lists | PARTIAL | `serials_routing` table | Schema exists | No routing UI | — | Routing UI |

## N. ELECTRONIC RESOURCE MANAGEMENT

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| E-resource providers | NOT_IMPLEMENTED | — | — | — | — | — |
| Packages | NOT_IMPLEMENTED | — | — | — | — | — |
| Platforms | NOT_IMPLEMENTED | — | — | — | — | — |
| Electronic titles | NOT_IMPLEMENTED | — | — | — | — | — |
| Coverage | NOT_IMPLEMENTED | — | — | — | — | — |
| Licenses | SCHEMA_ONLY | `ir_licenses` table | Schema exists | No license management | — | License UI |
| Agreements | NOT_IMPLEMENTED | — | — | — | — | — |
| Access URLs | PARTIAL | `directory_databases` table | Directory exists | No ERM integration | directory.test.ts | ERM integration |
| Usage | NOT_IMPLEMENTED | — | — | — | — | — |

## O. NOTICES / COMMUNICATIONS

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Templates | PARTIAL | `src/server/circulation/notices.ts` | Content generation | No template UI | notices.test.ts | Template UI |
| Checkout receipt | NOT_IMPLEMENTED | — | — | — | — | — |
| Return receipt | PARTIAL | `generateNoticeContent()` | Content exists | 0 callers | — | Wiring |
| Due soon | PARTIAL | `generateNoticeContent()` | Content exists | 0 callers | — | Wiring |
| Overdue | PARTIAL | `generateNoticeContent()` | Content exists | 0 callers | — | Wiring |
| Hold ready | PARTIAL | `generateNoticeContent()` | Content exists | 0 callers | — | Wiring |
| Account notices | NOT_IMPLEMENTED | — | — | — | — | — |
| Repository workflow emails | NOT_IMPLEMENTED | — | — | — | — | — |
| Acquisition notices | NOT_IMPLEMENTED | — | — | — | — | — |
| Print slips | NOT_IMPLEMENTED | — | — | — | — | — |
| Email | PARTIAL | `src/server/email/` | Resend + Gmail fallback | Domain unverified | — | Domain verification |
| In-app | PARTIAL | `notifications` table | Notification system | No preferences | — | Preferences |
| SMS adapters | NOT_IMPLEMENTED | — | — | — | — | — |
| Scheduling | NOT_IMPLEMENTED | — | — | — | — | — |

## P. REPORTING

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Report writer | PARTIAL | `src/server/reports/reportWriter.ts` | 5 report types | No UI callers | reportWriter.test.ts | UI wiring |
| Saved reports | NOT_IMPLEMENTED | — | — | — | — | — |
| Filters | PARTIAL | Date range only | Basic filtering | No grouping/sorting | — | Grouping |
| Aggregation | NOT_IMPLEMENTED | — | — | — | — | — |
| SQL reports | NOT_IMPLEMENTED | — | — | — | — | — |
| Report permissions | NOT_IMPLEMENTED | — | — | — | — | — |
| Export CSV | PARTIAL | `reportToCsv()` | CSV export | No XLSX/PDF | — | XLSX/PDF |
| Scheduling | NOT_IMPLEMENTED | — | — | — | — | — |
| UI callers | NOT_IMPLEMENTED | — | — | — | — | — |
| Audit | NOT_IMPLEMENTED | — | — | — | — | — |

## Q. ANALYTICS

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Event capture | PARTIAL | `src/server/analytics/eventRecorder.ts` | recordEvent exists | 0 callers | — | Wiring |
| Catalogue views | PARTIAL | `catalogue_items.view_count` | Counter exists | No view tracking job | — | Tracking job |
| Repository views | NOT_IMPLEMENTED | — | — | — | — | — |
| Downloads | NOT_IMPLEMENTED | — | — | — | — | — |
| Searches | NOT_IMPLEMENTED | — | — | — | — | — |
| Circulation analytics | NOT_IMPLEMENTED | — | — | — | — | — |
| Active borrowers | NOT_IMPLEMENTED | — | — | — | — | — |
| Popular titles | NOT_IMPLEMENTED | — | — | — | — | — |
| Repository usage | NOT_IMPLEMENTED | — | — | — | — | — |
| Top items | NOT_IMPLEMENTED | — | — | — | — | — |
| Faculty/department filters | NOT_IMPLEMENTED | — | — | — | — | — |
| Live vs demo data | NOT_IMPLEMENTED | — | — | — | — | — |
| Analytics UI | PARTIAL | `src/app-pages/admin/Analytics.tsx` | Dashboard exists | Reads empty table | — | Data wiring |
| Bot filtering | NOT_IMPLEMENTED | — | — | — | — | — |

## R. INSTITUTIONAL REPOSITORY

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Communities | PARTIAL | `repository_communities` table | Schema exists | No CRUD API | — | CRUD API |
| Collections | PARTIAL | `repository_collections` table | Schema exists | No CRUD API | — | CRUD API |
| Repository items | PARTIAL | `repository_items` table, API | GET with files array | No POST/PUT/DELETE | — | Full CRUD |
| Metadata | PARTIAL | `repository_items` columns | Basic metadata | No metadata registry | — | Registry |
| Multi-file items | PARTIAL | `repository_files` table | Schema exists | No multi-file upload UI | files.test.ts | Upload UI |
| Repository files/bitstreams | PARTIAL | `repository_files` table, `fileService.ts` | Upload/download/delete | No per-file analytics | — | Analytics |
| Storage | PARTIAL | Supabase Storage + B2 | Two providers | No unified abstraction | b2Client.test.ts | Abstraction |
| Secure downloads | PARTIAL | `app/api/repository/files/[id]/download/route.ts` | Auth + embargo | — | — | — |
| File roles | PARTIAL | `repository_files.role` | ORIGINAL/SUPPLEMENTARY/etc | No role UI | — | Role UI |
| File-level access | PARTIAL | `repository_files.access_level` | Schema exists | No access UI | — | Access UI |
| Embargoes | PARTIAL | `repository_files.embargo_until` | Schema exists | No embargo UI | — | Embargo UI |
| Versions | PARTIAL | `item_versions` table | Schema exists | No version creation API | — | Version API |
| Withdrawal | NOT_IMPLEMENTED | — | — | — | — | — |
| Tombstones | NOT_IMPLEMENTED | — | — | — | — | — |
| Licenses | PARTIAL | `ir_licenses` table | Schema exists | No license UI | — | License UI |
| Rights | PARTIAL | `repository_items.visibility` | Field exists | No rights management | — | Rights UI |
| Researcher links | PARTIAL | `repository_items.submitter_id` | Field exists | No researcher integration | — | Integration |
| Collection configuration | NOT_IMPLEMENTED | — | — | — | — | — |

## S. REPOSITORY WORKFLOW

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Workflow definitions | SCHEMA_ONLY | `workflow_definitions` table | Table exists | No definition UI | — | Definition UI |
| Workflow steps | SCHEMA_ONLY | `workflow_steps` table | Table exists | No step UI | — | Step UI |
| Workflow instances | PARTIAL | `workflow_instances` table, `workflowService.ts` | Service layer exists | No instance UI | — | Instance UI |
| Workflow tasks | SCHEMA_ONLY | `workflow_tasks` table | Table exists | No task UI | — | Task UI |
| Workflow actions | PARTIAL | `workflow_actions` table, `transitionWorkflow()` | Action recording | No action UI | — | Action UI |
| Workflow comments | SCHEMA_ONLY | `workflow_comments` table | Table exists | No comment UI | — | Comment UI |
| State transitions | PARTIAL | `transitionWorkflow()` | Validated transitions | No transition UI | — | Transition UI |
| Reviewer assignment | NOT_IMPLEMENTED | — | — | — | — | — |
| Claim | PARTIAL | `claimTask()` | DB-level claim | No claim UI | — | Claim UI |
| Reassignment | NOT_IMPLEMENTED | — | — | — | — | — |
| Return for correction | PARTIAL | `transitionWorkflow()` | State transition | No correction UI | — | Correction UI |
| Rejection | PARTIAL | `transitionWorkflow()` | State transition | No rejection UI | — | Rejection UI |
| Publication | PARTIAL | `transitionWorkflow()` | State transition | No publication UI | — | Publication UI |
| Withdrawal | PARTIAL | `transitionWorkflow()` | State transition | No withdrawal UI | — | Withdrawal UI |
| Workflow UI | NOT_IMPLEMENTED | — | — | — | — | — |
| Workflow tests | NOT_IMPLEMENTED | — | — | — | — | — |

## T. THESIS SUPERVISION

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Student submission | PARTIAL | `src/app-pages/ThesisSubmit.tsx` | Form exists | No file upload | — | File upload |
| Supervisor | PARTIAL | `thesis_supervisors` table | Schema exists | No supervisor UI | — | Supervisor UI |
| Department | PARTIAL | `theses.department` | Field exists | No department workflow | — | Department workflow |
| Faculty | PARTIAL | `theses.faculty` | Field exists | No faculty workflow | — | Faculty workflow |
| Library review | NOT_IMPLEMENTED | — | — | — | — | — |
| Correction/resubmission | NOT_IMPLEMENTED | — | — | — | — | — |
| Approval chain | PARTIAL | `thesis_workflow` table | Basic workflow | No full chain | — | Full chain |
| Notifications | PARTIAL | Email on supervisor action | Email exists | No supervisor notification | — | Supervisor notification |
| Audit history | PARTIAL | `thesis_workflow` table | Log exists | No history UI | — | History UI |
| Repository publication | NOT_IMPLEMENTED | — | — | — | — | — |

## U. REPOSITORY FILES / BITSTREAMS

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| repository_files | PARTIAL | `repository_files` table, migration | Table exists | No multi-file upload UI | files.test.ts | Upload UI |
| Multi-file support | PARTIAL | `repository_files` schema | Schema exists | No UI | — | UI |
| Upload UI | NOT_IMPLEMENTED | — | — | — | — | — |
| File roles | PARTIAL | `repository_files.role` | ORIGINAL/SUPPLEMENTARY/etc | No role UI | — | Role UI |
| Access levels | PARTIAL | `repository_files.access_level` | PUBLIC/AUTHENTICATED/etc | No access UI | — | Access UI |
| Embargo | PARTIAL | `repository_files.embargo_until` | Schema exists | No embargo UI | — | Embargo UI |
| Signed URLs | PARTIAL | `getFileDownload()` | 5-min signed URLs | — | — | — |
| Version relationship | PARTIAL | `repository_files.repository_version_id` | Column exists | No version assignment | — | Version assignment |
| Checksums | PARTIAL | `repository_files.checksum` | SHA-256 at ingest | No verification UI | — | Verification UI |
| File analytics | NOT_IMPLEMENTED | — | — | — | — | — |
| Storage keys | PARTIAL | `repository_files.storage_key` | Key exists | No key management | — | Key management |
| Migration from file_url | PARTIAL | Backfill migration | 0 rows migrated | No production data | — | Production migration |

## V. VERSIONING

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| Repository versions | PARTIAL | `item_versions` table | Schema exists | No version creation API | — | Version API |
| File-version relationships | PARTIAL | `repository_files.repository_version_id` | Column exists | No assignment logic | — | Assignment |
| Version history | PARTIAL | `item_versions` table | History exists | No history UI | — | History UI |
| Previous version retrieval | NOT_IMPLEMENTED | — | — | — | — | — |
| Change notes | PARTIAL | `item_versions.change_note` | Field exists | No change note UI | — | Change note UI |
| Citation persistence | NOT_IMPLEMENTED | — | — | — | — | — |
| Version-specific AIP | NOT_IMPLEMENTED | — | — | — | — | — |

## W. PRESERVATION

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| SHA-256 ingest checksum | PARTIAL | `fileService.ts` | Checksum at upload | No verification | — | Verification |
| Scheduled fixity | PARTIAL | `worker/handlers/preservation.ts` | Worker handler exists | No scheduling | — | Scheduling |
| Preservation worker | PARTIAL | `verifyFixity` handler | Handler exists | Not running in production | — | Production deployment |
| Preservation events | SCHEMA_ONLY | `preservation_events` table | Table exists | No event recording | — | Event recording |
| Incidents | SCHEMA_ONLY | `preservation_incidents` table | Table exists | No incident creation | — | Incident creation |
| Mismatch handling | PARTIAL | `verifyFixity` handler | Mismatch detection | No admin notification | — | Admin notification |
| Missing object handling | PARTIAL | `verifyFixity` handler | Missing detection | — | — | — |
| Preservation dashboard | NOT_IMPLEMENTED | — | — | — | — | — |
| Recheck | NOT_IMPLEMENTED | — | — | — | — | — |
| AIP generation | PARTIAL | `src/server/preservation/aipExport.ts` | Real AIP export | No AIP validation | — | Validation |
| AIP validation | PARTIAL | `validateAIP()` | Validation function | No validation test | — | Validation test |
| AIP restore | NOT_IMPLEMENTED | — | — | — | — | — |
| Backup/restore | NOT_IMPLEMENTED | — | — | — | — | — |

## X. FULL-TEXT SEARCH

| Feature | Status | Evidence | What works | What doesn't | Tests | Remaining |
|---|---|---|---|---|---|---|
| PostgreSQL FTS | PARTIAL | `search_vector` on `ir_items` | FTS on ir_items only | No FTS on repository_items | — | Repository FTS |
| Metadata indexing | PARTIAL | `search_vector` trigger | Title/abstract/keywords | No full-text extraction | — | Full-text |
| Abstract indexing | PARTIAL | `search_vector` weight B | Abstract indexed | — | — | — |
| Extracted full text | PARTIAL | `textExtraction.ts` | Text-based formats only | No PDF/DOCX | — | PDF/DOCX |
| TXT | PARTIAL | `extractText()` | Text extraction | — | — | — |
| CSV | PARTIAL | `extractText()` | Text extraction | — | — | — |
| JSON | PARTIAL | `extractText()` | Text extraction | — | — | — |
| PDF | NOT_IMPLEMENTED | — | — | — | — | — |
| DOCX | NOT_IMPLEMENTED | — | — | — | — | — |
| OCR | NOT_IMPLEMENTED | — | — | — | — | — |
| Permission-aware indexing | NOT_IMPLEMENTED | — | — | — | — | — |
| Snippets | NOT_IMPLEMENTED | — | — | — | — | — |
| Server-side facets | NOT_IMPLEMENTED | — | — | — | — | — |
| Ranking | PARTIAL | `scoreRow()` | Basic scoring | No advanced ranking | — | Advanced ranking |
| Reindexing | NOT_IMPLEMENTED | — | — | — | — | — |

## Y. OAI-PMH

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Endpoint | PARTIAL | L4 | `app/api/oai/route.ts` | Deployed | — | — |
| Identify | PARTIAL | L4 | `route.ts` | Works | — | — |
| ListMetadataFormats | PARTIAL | L4 | `route.ts` | Works | — | — |
| ListSets | PARTIAL | L4 | `route.ts` | Works | — | — |
| ListIdentifiers | PARTIAL | L4 | `route.ts` | Works | — | — |
| ListRecords | PARTIAL | L4 | `route.ts` | Works | 0 records in prod | — |
| GetRecord | PARTIAL | L4 | `route.ts` | Works | — | — |
| Resumption tokens | PARTIAL | L4 | `route.ts` | Works | — | — |
| Date filtering | PARTIAL | L4 | `route.ts` | Works | — | — |
| Sets | PARTIAL | L4 | `route.ts` | Works | — | — |
| Deleted records | NOT_IMPLEMENTED | — | — | — | — | — |
| oai_dc | PARTIAL | L4 | `route.ts` | Works | — | — |
| DataCite | NOT_IMPLEMENTED | — | — | — | — | — |
| MARCXML | NOT_IMPLEMENTED | — | — | — | — | — |
| MODS | NOT_IMPLEMENTED | — | — | — | — | — |
| Private record filtering | PARTIAL | L4 | `route.ts` | Filters published+global | — | — |
| External harvester validation | NOT_IMPLEMENTED | — | — | — | — | — |

## Z. SRU

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Explain | PARTIAL | L4 | `app/api/sru/route.ts` | Works | — | — |
| searchRetrieve | PARTIAL | L4 | `app/api/sru/route.ts` | Works | — | — |
| CQL parser | PARTIAL | L2 | `src/server/interoperability/cqlParser.ts` | Parser exists | Not wired to SRU | SRU wiring |
| Indexes | PARTIAL | L2 | `FIELD_MAPPINGS` | Field mappings | — | — |
| Operators | PARTIAL | L2 | `=`, `any`, `all` | Basic operators | — | — |
| Pagination | PARTIAL | L4 | `route.ts` | Works | — | — |
| Schemas | NOT_IMPLEMENTED | — | — | — | — | — |
| Diagnostics | PARTIAL | L4 | `route.ts` | Works | — | — |
| Live testing | NOT_IMPLEMENTED | — | — | — | — | — |
| External client testing | NOT_IMPLEMENTED | — | — | — | — | — |

## AA. Z39.50

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Actual Z39.50 protocol client | NOT_IMPLEMENTED | L1 | `src/app-pages/admin/CatalogueNew.tsx` | Open Library relabel | No real Z39.50 | YAZ/ZOOM |
| YAZ/ZOOM | NOT_IMPLEMENTED | — | — | — | — | — |
| Targets | NOT_IMPLEMENTED | — | — | — | — | — |
| Host/port/database | NOT_IMPLEMENTED | — | — | — | — | — |
| Authentication | NOT_IMPLEMENTED | — | — | — | — | — |
| Search | NOT_IMPLEMENTED | — | — | — | — | — |
| MARC retrieval | NOT_IMPLEMENTED | — | — | — | — | — |
| Preview | NOT_IMPLEMENTED | — | — | — | — | — |
| Import | NOT_IMPLEMENTED | — | — | — | — | — |
| Authority retrieval | NOT_IMPLEMENTED | — | — | — | — | — |
| Real public-server test | NOT_IMPLEMENTED | — | — | — | — | — |

## AB. SWORD

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Service document | PARTIAL | L4 | `app/api/sword/service/route.ts` | Service doc exists | — | — |
| Authenticated deposit | NOT_IMPLEMENTED | — | — | — | — | — |
| Metadata deposit | NOT_IMPLEMENTED | — | — | — | — | — |
| File upload | NOT_IMPLEMENTED | — | — | — | — | — |
| Update | NOT_IMPLEMENTED | — | — | — | — | — |
| Status | NOT_IMPLEMENTED | — | — | — | — | — |
| Withdraw/delete | NOT_IMPLEMENTED | — | — | — | — | — |
| Workflow integration | NOT_IMPLEMENTED | — | — | — | — | — |
| External client testing | NOT_IMPLEMENTED | — | — | — | — | — |

## AC. RESOURCESYNC

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Capability list | NOT_IMPLEMENTED | L1 | `src/server/interoperability/resourcesync.ts` | Builder exists | No endpoint | Endpoint |
| Resource list | NOT_IMPLEMENTED | L1 | Builder exists | — | No endpoint | Endpoint |
| Change list | NOT_IMPLEMENTED | L1 | Builder exists | — | No endpoint | Endpoint |
| Modifications | NOT_IMPLEMENTED | — | — | — | — | — |
| Deletions | NOT_IMPLEMENTED | — | — | — | — | — |
| Public/restricted filtering | NOT_IMPLEMENTED | — | — | — | — | — |
| Deployed endpoints | NOT_IMPLEMENTED | — | — | — | — | — |
| Validator/external testing | NOT_IMPLEMENTED | — | — | — | — | — |

## AD. SIGNPOSTING

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| cite-as | NOT_IMPLEMENTED | L1 | `src/server/interoperability/signposting.ts` | Builder exists | No Link headers | Link headers |
| describedby | NOT_IMPLEMENTED | L1 | Builder exists | — | No Link headers | Link headers |
| item | NOT_IMPLEMENTED | L1 | Builder exists | — | No Link headers | Link headers |
| author | NOT_IMPLEMENTED | L1 | Builder exists | — | No Link headers | Link headers |
| license | NOT_IMPLEMENTED | L1 | Builder exists | — | No Link headers | Link headers |
| type | NOT_IMPLEMENTED | L1 | Builder exists | — | No Link headers | Link headers |
| Actual Link headers | NOT_IMPLEMENTED | — | — | — | — | — |
| Metadata URLs | NOT_IMPLEMENTED | — | — | — | — | — |
| File privacy | NOT_IMPLEMENTED | — | — | — | — | — |

## AE. COAR NOTIFY

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Inbox | PARTIAL | L4 | `app/api/coar-notify/inbox/route.ts` | Deployed with HMAC auth | — | — |
| Payload validation | PARTIAL | L4 | `validateCoarNotify()` | Shape validation | — | — |
| Trust/security | PARTIAL | L4 | HMAC-SHA256 shared secret | Deployment-specific | Not standards-interoperable | Standards adapter |
| Signatures | PARTIAL | L4 | HMAC verification | Works | — | — |
| Replay protection | PARTIAL | L4 | `coar_nonces` table + in-memory | Persistent + in-memory | — | — |
| SSRF | PARTIAL | L4 | `validateCoarUrl()` | Blocks private IPs | — | — |
| Activity processing | PARTIAL | L4 | Insert to coar_notifications | Basic processing | — | — |
| Audit history | PARTIAL | L4 | `coar_notifications` table | History exists | — | — |
| Retry | NOT_IMPLEMENTED | — | — | — | — | — |
| External interoperability | NOT_IMPLEMENTED | — | — | — | — | — |

## AF. OPENURL

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Link generation | NOT_IMPLEMENTED | L1 | `src/server/interoperability/openurl.ts` | Builder exists | No endpoint | Endpoint |
| Resolver configuration | NOT_IMPLEMENTED | — | — | — | — | — |
| Catalogue UI | NOT_IMPLEMENTED | — | — | — | — | — |
| Repository UI | NOT_IMPLEMENTED | — | — | — | — | — |
| Resolver endpoint | NOT_IMPLEMENTED | — | — | — | — | — |

## AG. KBART

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Endpoint | BROKEN | L0 | `app/api/serials/kbart/route.ts` | Always 500 | Route broken | Fix auth |
| Output | PARTIAL | L2 | `src/server/interoperability/kbart.ts` | Generator exists | — | — |
| Required fields | PARTIAL | L2 | Generator | Basic fields | — | — |
| Provider/package model | NOT_IMPLEMENTED | — | — | — | — | — |
| Coverage | NOT_IMPLEMENTED | — | — | — | — | — |
| Identifiers | PARTIAL | L2 | Generator | ISSN/ISBN | — | — |
| Route stability | BROKEN | L0 | 500 error | — | — | Fix |
| Validation | NOT_IMPLEMENTED | — | — | — | — | — |

## AH. DOI / DATACITE / ZENODO

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| DOI field | PARTIAL | L4 | `repository_items.doi` | Field exists | — | — |
| Actual minting | BLOCKED_EXTERNAL | L1 | `src/server/identifiers/` | Zenodo provider exists | No credentials | Credentials |
| DataCite adapter | NOT_IMPLEMENTED | — | — | — | — | — |
| Reserve/publish/update | NOT_IMPLEMENTED | — | — | — | — | — |
| State tracking | NOT_IMPLEMENTED | — | — | — | — | — |
| Test DOI | NOT_IMPLEMENTED | — | — | — | — | — |
| Production DOI | NOT_IMPLEMENTED | — | — | — | — | — |
| Zenodo deposit | BLOCKED_EXTERNAL | L1 | Provider exists | — | No credentials | Credentials |
| Credentials | BLOCKED_EXTERNAL | — | — | — | — | — |
| UI | NOT_IMPLEMENTED | — | — | — | — | — |

## AI. ORCID

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| ORCID field | PARTIAL | L4 | `repository_items.orcid_ids` | Field exists | — | — |
| Checksum validation | NOT_IMPLEMENTED | — | — | — | — | — |
| OAuth | NOT_IMPLEMENTED | — | — | — | — | — |
| Verified connection | NOT_IMPLEMENTED | — | — | — | — | — |
| Profile import | NOT_IMPLEMENTED | — | — | — | — | — |
| Token handling | NOT_IMPLEMENTED | — | — | — | — | — |
| Disconnect | NOT_IMPLEMENTED | — | — | — | — | — |
| Write/sync | NOT_IMPLEMENTED | — | — | — | — | — |
| UI callers | NOT_IMPLEMENTED | — | — | — | — | — |

## AJ. ROR

| Feature | Status | Maturity | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| ROR lookup | PARTIAL | L4 | `src/server/interoperability/ror.ts` | Proxy exists | 0 UI callers | UI integration |
| Organization entities | NOT_IMPLEMENTED | — | — | — | — | — |
| Verified selection | NOT_IMPLEMENTED | — | — | — | — | — |
| Institution relationship | NOT_IMPLEMENTED | — | — | — | — | — |
| UI use | NOT_IMPLEMENTED | — | — | — | — | — |

## AK. CRIS / RESEARCH INFORMATION MANAGEMENT

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|
| Researchers | PARTIAL | `researcher_profiles` table | Profile schema | No researcher API | API |
| Publications | PARTIAL | `repository_items` | Items exist | No publication entity | Entity |
| Datasets | NOT_IMPLEMENTED | — | — | — | — |
| Grants | PARTIAL | `researcher_grants` table | Schema exists | No grant API | API |
| Projects | NOT_IMPLEMENTED | — | — | — | — |
| Organizations | NOT_IMPLEMENTED | — | — | — | — |
| Departments | PARTIAL | `patrons.department` | Field exists | No department entity | Entity |
| Faculties | PARTIAL | `patrons.faculty_code` | Field exists | No faculty entity | Entity |
| Research groups | NOT_IMPLEMENTED | — | — | — | — |
| Awards | NOT_IMPLEMENTED | — | — | — | — |
| Supervision | PARTIAL | `thesis_supervisors` table | Schema exists | No supervision API | API |
| Relationships | NOT_IMPLEMENTED | — | — | — | — |
| Provenance | NOT_IMPLEMENTED | — | — | — | — |
| Public researcher profiles | PARTIAL | `researcher_profiles` table | Schema exists | No profile UI | Profile UI |

## AL. FEDERATED DISCOVERY

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|
| Open Library | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| Google Books | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| DOAB | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| DOAJ | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| OpenAlex | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| CrossRef | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| Internet Archive | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| CORE | BLOCKED_EXTERNAL | `adapters.ts` | Adapter exists | No API key | API key |
| Project Gutenberg | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| Standard Ebooks | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| PubMed | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| PubMed Central | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| HathiTrust | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| Unpaywall | PARTIAL | `adapters.ts` | Adapter exists | — | — |
| **Working count** | **13/14** | — | 13 work without keys | CORE needs key | — |

## AM. AI LIBRARIAN

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|
| Conversational interface | PARTIAL | `src/app-pages/AILibrarian.tsx` | Chat UI exists | No streaming | Streaming |
| Tools available | NOT_IMPLEMENTED | — | — | — | — |
| Actual tool count | 0 | — | — | — | — |
| Permissions | NOT_IMPLEMENTED | — | — | — | — |
| Catalogue access | NOT_IMPLEMENTED | — | — | — | — |
| Repository access | NOT_IMPLEMENTED | — | — | — | — |
| Research discovery | NOT_IMPLEMENTED | — | — | — | — |
| Circulation actions | NOT_IMPLEMENTED | — | — | — | — |
| Hallucination protections | PARTIAL | Prompt engineering | Basic protections | No RAG | RAG |
| Citations | NOT_IMPLEMENTED | — | — | — | — |
| Worker integration | NOT_IMPLEMENTED | — | — | — | — |
| External AI provider | PARTIAL | `providerRouter.ts` | Multi-provider | — | — |
| Fallback behavior | PARTIAL | `providerRouter.ts` | Fallback exists | — | — |

## AN. BACKGROUND WORKERS / AUTOMATION

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|
| Worker system | COMPLETE | `worker/index.ts` | Full lifecycle | — | — |
| Job types | 11 | `worker/handlers/index.ts` | 11 registered | — | — |
| catalogue.enrich | PARTIAL | Handler exists | AI enrichment | — | — |
| resources.harvest | PARTIAL | Handler exists | External harvest | — | — |
| resources.downloadToB2 | BLOCKED_EXTERNAL | Handler exists | B2 download | No B2 creds | Credentials |
| repository.extractMetadata | PARTIAL | Handler exists | AI metadata | — | — |
| communications.draftNewsletter | PARTIAL | Handler exists | AI newsletter | — | — |
| reports.weeklyTenantReport | PARTIAL | Handler exists | Weekly report | — | — |
| system.healthCheck | COMPLETE | Handler exists | Health check | — | — |
| circulation.overdueReminders | PARTIAL | Handler exists | Overdue detection | — | — |
| circulation.sendOverdueEmails | BLOCKED_EXTERNAL | Handler exists | Email sending | No email creds | Credentials |
| circulation.sendDueSoonEmails | BLOCKED_EXTERNAL | Handler exists | Email sending | No email creds | Credentials |
| preservation.verifyFixity | PARTIAL | Handler exists | Fixity verification | — | — |
| Retries | COMPLETE | `worker/retry.ts` | Exponential backoff | — | — |
| Dead-letter | NOT_IMPLEMENTED | — | — | — | — |
| Runtime deployment | PARTIAL | Container exists | Worker runs | — | — |
| Last known functionality | PARTIAL | — | Some jobs work | — | — |
| Credentials | BLOCKED_EXTERNAL | — | — | — | — |

## AO. STORAGE

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|
| Supabase Storage | PARTIAL | Buckets exist | repository/theses | Public buckets | Private buckets |
| Backblaze B2 | PARTIAL | `b2Client.ts` | Client exists | No credentials | Credentials |
| Active provider | PARTIAL | Both exist | — | No unified abstraction | Abstraction |
| Inactive provider | PARTIAL | — | — | — | — |
| Private/public state | PARTIAL | — | — | — | — |
| Signed URLs | PARTIAL | `getSignedDownloadUrl()` | 5-min URLs | — | — |
| Storage abstraction | NOT_IMPLEMENTED | — | — | — | — |
| Unused legacy paths | PARTIAL | — | — | — | — |
| File deletion | PARTIAL | `deleteObject()` | Exists | No API route | API route |
| Cleanup | NOT_IMPLEMENTED | — | — | — | — |

## AP. API / INTEGRATION ARCHITECTURE

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| REST APIs | PARTIAL | `app/api/**` | 82+ routes | — | — |
| API documentation | PARTIAL | `docs/api.md` | 23/82 documented | 59 undocumented | Full docs |
| OpenAPI | NOT_IMPLEMENTED | — | — | — | — |
| Authentication | PARTIAL | JWT Bearer | Works | — | — |
| Pagination | PARTIAL | `limit` param | Basic | — | — |
| Versioning | NOT_IMPLEMENTED | — | — | — | — |
| Webhooks | NOT_IMPLEMENTED | — | — | — | — |
| Domain events | NOT_IMPLEMENTED | — | — | — | — |
| Integration APIs | NOT_IMPLEMENTED | — | — | — | — |

## AQ. MULTILINGUAL

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| i18n system | NOT_IMPLEMENTED | `src/lib/i18n.ts` | en/fr strings | 0 callers | Wire i18n |
| Actual languages | 0 | — | — | — | — |
| Translation coverage | 0% | — | — | — | — |
| Missing strings | — | — | — | — | — |
| Multilingual metadata | NOT_IMPLEMENTED | — | — | — | — |
| Locale fallback | NOT_IMPLEMENTED | — | — | — | — |

## AR. ACCESSIBILITY

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Keyboard navigation | PARTIAL | shadcn/ui | Basic | — | — |
| Labels | PARTIAL | Some aria-labels | Basic | — | — |
| Focus | PARTIAL | — | — | — | — |
| Dialogs | PARTIAL | shadcn/ui | Basic | — | — |
| Screen-reader semantics | PARTIAL | — | — | — | — |
| Contrast | PARTIAL | — | — | — | — |
| Automated tests | NOT_IMPLEMENTED | — | — | — | — |
| WCAG target | NOT_IMPLEMENTED | — | — | — | — |

## AS. OBSERVABILITY

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Structured logs | PARTIAL | `src/server/logging/logger.ts` | Basic logging | No JSON | JSON logging |
| Health endpoints | PARTIAL | `/api/health` | App health | — | — |
| Worker health | PARTIAL | `worker/health.ts` | Worker health | — | — |
| Queue monitoring | NOT_IMPLEMENTED | — | — | — | — |
| Provider health | NOT_IMPLEMENTED | — | — | — | — |
| Request IDs | NOT_IMPLEMENTED | — | — | — | — |
| Error reporting | NOT_IMPLEMENTED | — | — | — | — |
| Storage health | NOT_IMPLEMENTED | — | — | — | — |
| Search health | NOT_IMPLEMENTED | — | — | — | — |
| Preservation health | NOT_IMPLEMENTED | — | — | — | — |

## AT. BACKUP / DISASTER RECOVERY

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| DB backup | NOT_IMPLEMENTED | — | — | — | — |
| Storage backup | NOT_IMPLEMENTED | — | — | — | — |
| Restore procedure | NOT_IMPLEMENTED | — | — | — | — |
| Restore test | NOT_IMPLEMENTED | — | — | — | — |
| Search rebuild | NOT_IMPLEMENTED | — | — | — | — |
| RPO | NOT_IMPLEMENTED | — | — | — | — |
| RTO | NOT_IMPLEMENTED | — | — | — | — |
| Documented DR | NOT_IMPLEMENTED | — | — | — | — |

## AU. PERFORMANCE / SCALE

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| Load tests | NOT_IMPLEMENTED | — | — | — | — |
| Search performance | PARTIAL | p50/p95 measured | Basic metrics | No load test | Load test |
| Repository performance | NOT_IMPLEMENTED | — | — | — | — |
| Circulation performance | NOT_IMPLEMENTED | — | — | — | — |
| Analytics performance | NOT_IMPLEMENTED | — | — | — | — |
| DB indexes | PARTIAL | 327 indexes | Basic indexes | Hot table gaps | Index gaps |
| p50 | PARTIAL | ~280-430ms | Measured | — | — |
| p95 | PARTIAL | ~450-620ms | Measured | — | — |
| p99 | NOT_IMPLEMENTED | — | — | — | — |
| Synthetic datasets | NOT_IMPLEMENTED | — | — | — | — |

## AV. DEVOPS / QUALITY

| Feature | Status | Evidence | What works | What doesn't | Remaining |
|---|---|---|---|---|---|---|
| TypeScript | COMPLETE | 0 errors | Clean | — | — |
| ESLint | COMPLETE | 0 errors | Clean | — | — |
| Tests | COMPLETE | 210 pass | All pass | — | — |
| Build | COMPLETE | exit 0 | Clean | — | — |
| CI | PARTIAL | `.github/workflows/ci.yml` | Gates exist | — | — |
| Migrations | PARTIAL | 58 SQL files | Applied | — | — |
| Dependency audit | PARTIAL | 13 vulns | 0 critical | 1 high | Fix high |
| Docker health | PARTIAL | Containers healthy | App + worker | — | — |

---

## Completion Statistics

| Status | Count |
|---|---|
| COMPLETE | 8 |
| PARTIAL | 68 |
| BACKEND_ONLY | 2 |
| UI_ONLY | 1 |
| SCHEMA_ONLY | 8 |
| MOCKED | 0 |
| BROKEN | 1 |
| BLOCKED_EXTERNAL | 5 |
| NOT_IMPLEMENTED | 42 |
| NOT_APPLICABLE | 0 |

**Total features audited: 135**

**Completion percentage: 6%** (8/135 complete)

Note: This percentage is misleading because most features are PARTIAL (68/135 = 50%). The platform has broad functionality but significant gaps in depth and integration.
