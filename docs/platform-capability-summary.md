# ESUT Library Platform Capability Summary

Date: 2026-09-30 · Commit: `dacbeed`

## Current Technical Baseline

| Metric | Value |
|---|---|
| Git commit | `dacbeed` |
| Framework | Next.js 16.3.6 + TypeScript |
| Frontend | React SPA (App Router + client components) |
| Backend | Next.js API routes + Supabase Edge Functions |
| Database | Supabase PostgreSQL (125+ tables, all RLS-enabled) |
| ORM/Query | Supabase JS (PostgREST) |
| Storage | Supabase Storage + Backblaze B2 (configured, unused) |
| Authentication | Supabase Auth (JWT) |
| Authorization | RBAC (10 roles) + RLS (125/125 tables) |
| Job/Worker | Custom worker (11 job types, DB-backed queue) |
| Search | PostgreSQL FTS + federated external providers |
| AI | Multi-provider router (Ollama/Gemini/Groq/NVIDIA/Gateway) |
| Deployment | Docker (app + worker containers) |
| TypeScript | 0 errors |
| Lint | 0 errors, 0 warnings |
| Tests | 210 passed / 0 failed / 0 skipped (53 files) |
| Build | exit 0 |
| Vulnerabilities | 13 (0 critical, 1 high, 9 moderate, 3 low) |

## Fully Complete Features

### ILS
- Patron registration with email verification
- Login/logout with lockout
- Password reset flow
- Email verification flow

### Repository
- Repository item listing with files array
- Secure file download with auth + embargo
- File upload with SHA-256 checksum

### Research/CRIS
- Researcher profile schema
- Grants schema

### Discovery
- Federated search across 13 external OA providers (14 total, CORE needs key)
- Local catalogue search with FTS

### AI
- AI librarian chat interface (no tool use)
- Multi-provider fallback

### Engagement
- Homepage with animated stats
- Events with calendar view
- CMS with pages/banners/menu
- Wellbeing resources with AI companion

### Infrastructure
- Worker system with retries and health
- CI quality gates (tsc + lint + test + build)
- Docker containers with healthchecks

## Partial Features

### ILS
- Patron management (no guarantors, no restrictions, no import/export)
- Catalogue/OPAC (no facet counts, no saved searches, no recommendations)
- MARC cataloguing (no MARCXML import, no frameworks, no batch mod)
- Authority control (schema only, no CRUD, no linking)
- Circulation (no checkout UI, no holds queue, no recalls, no transfers)
- SIP2 (auth hardened, no TCP listener, no check-in/renewal)
- ILL (schema + basic API, no workflow)
- Acquisitions (no receiving, no encumbrance, no claims)
- EDI (X12 generate only, no EDIFACT, no real supplier)
- POS/Payments (schema only)
- Serials (no prediction algorithm, no receiving UI)
- Notices (content exists, 0 callers, no template UI)
- Reporting (5 types, no UI callers, no saved reports)
- Analytics (dashboard exists, 0 event capture wired)

### Repository
- Multi-file items (schema exists, no upload UI)
- Workflow engine (schema + service, no UI, no tests)
- Thesis supervision (basic flow, no library review, no resubmission)
- Versioning (schema only, no version API)
- Preservation (fixity worker exists, no dashboard, no restore test)
- Full-text search (text-based formats only, no PDF/DOCX)

### Interoperability
- OAI-PMH (deployed, 4 test items, no external validation)
- SRU (CQL parser exists, not wired to endpoint)
- SWORD (service document only)
- ResourceSync (builders only, no endpoints)
- Signposting (builders only, no Link headers)
- COAR Notify (HMAC auth, deployment-specific, no external interop)
- OpenURL (builder only, no endpoint)
- KBART (broken — always 500)
- DOI/Zenodo (provider exists, no credentials)
- ORCID (lookup only, no OAuth)
- ROR (lookup only, 0 UI callers)

### Platform
- Authentication (no SSO/OIDC/SAML/LDAP)
- Authorization (role model drift, some permissive RLS)
- Storage (two providers, no unified abstraction)
- API (82+ routes, no OpenAPI, no versioning)
- Multilingual (i18n strings exist, 0 callers)
- Accessibility (basic, no automated tests)
- Observability (basic health, no structured logs)
- Backup/DR (not implemented)
- Performance (no load tests, no p99)

## Backend-Only Features

- EDI 850 generation (no real supplier)
- COAR Notify inbox (no external interop)
- Preservation fixity worker (not running in production)
- Workflow service layer (no UI)
- Text extraction pipeline (not wired to search)

## UI-Only Features

- Z39.50 search panel (uses Open Library REST, not real Z39.50)

## Schema-Only Features

- Authority control (no CRUD, no linking)
- POS/Payments (no processing)
- ILL workflow (no processing logic)
- ERM (no e-resource management)
- Backup/DR (no implementation)
- Multilingual metadata (no multilingual support)

## Broken Features

- KBART endpoint (always returns 500)

## Blocked External Features

- CORE federated search (needs API key)
- B2 storage (needs credentials)
- DOI/Zenodo minting (needs credentials)
- Overdue/due-soon emails (needs email domain verification)
- SIP2 production (needs TCP listener + hardware)

## Completely Missing Features

- SSO/OIDC/SAML/LDAP
- MARC frameworks
- Staged MARC import
- Overlay rules
- Batch modification
- Authority merge
- External authority lookup (VIAF/LC)
- Circulation desk UI
- Hold queue management
- Recalls
- Transfers
- Circulation rules engine
- Lost items
- Barcode scanning integration
- Offline circulation
- SIP2 TCP listener
- ILL workflow
- Acquisitions receiving/encumbrance/claims
- EDI EDIFACT
- POS/cash register
- Serials prediction/receiving
- ERM
- Notice template UI
- Notice scheduling
- Report saved/scheduled
- Analytics event capture
- Repository CRUD API
- Multi-file upload UI
- Workflow UI
- Thesis library review
- Versioning API
- Preservation dashboard
- AIP restore
- PDF/DOCX text extraction
- OCR
- Server-side facets
- OAI external validation
- SRU CQL wiring
- Z39.50 real client
- SWORD deposit
- ResourceSync endpoints
- Signposting Link headers
- COAR external interop
- OpenURL endpoint
- KBART fix
- DOI UI
- ORCID OAuth
- ROR UI
- CRIS relationships
- AI tool use
- AI citations
- AI RAG
- Dead-letter queue
- Job priorities
- Job timeouts
- Storage abstraction
- File deletion API
- Cleanup lifecycle
- Image optimization
- Virus scanning
- OpenAPI docs
- API versioning
- Webhooks
- Domain events
- i18n wiring
- Automated a11y tests
- Structured logging
- Request IDs
- Error reporting
- Provider health monitoring
- Queue monitoring
- Automated backups
- Restore testing
- Load testing
- p99 metrics
- Synthetic datasets
- CI secrets scanning
- SAST
- E2E tests
- Pre-commit hooks
- Code coverage

## Features Ahead of Typical Koha Scope

- Federated OA discovery (13 sources)
- AI librarian chat
- Integrated IR + CRIS + ILS in one platform
- Thesis supervision workflow
- Student engagement (blog/events/forum/CMS/wellbeing)
- QR digital library card
- Unified identity across ILS/IR/CRIS
- Worker automation system

## Areas Where Koha Is Still Stronger

- MARC cataloguing depth (frameworks, validation, batch mod)
- Authority control (full CRUD, linking, merge, external lookup)
- Circulation maturity (desk UI, holds, recalls, transfers, rules)
- Acquisitions depth (receiving, encumbrance, claims, EDI)
- Serials management (prediction, receiving, claims)
- SIP2 production (TCP listener, hardware interop)
- POS/cash register
- Notices (templates, scheduling, delivery tracking)
- Reporting (saved reports, SQL, scheduling, permissions)
- Multilingual (40+ languages, mature ecosystem)
- Ecosystem (20+ years, plugins, community, translations)
- API maturity (OpenAPI, versioning, webhooks)

## Features Ahead of Typical DSpace Scope

- Full ILS operations (circulation, patrons, acquisitions, serials)
- Federated OA discovery across catalogue + IR
- AI librarian
- Thesis supervision workflow
- Student engagement platform
- QR library card
- Unified identity

## Areas Where DSpace Is Still Stronger

- Multi-file object model (bundles/bitstreams)
- Workflow engine (configurable, claim/return/audit)
- Preservation (scheduled fixity, AIP, restore)
- Full-text discovery (Solr, extraction, facets)
- OAI-PMH (multi-format, external validation)
- SWORD deposit
- ResourceSync endpoints
- Signposting Link headers
- Metadata registry
- Authority framework
- Google Scholar optimization
- Versioning (file-level, citation persistence)

## Capabilities ESUT Uniquely Combines

1. **ILS + IR + CRIS in one platform** — circulation, repository, and research profiles in a single deployment with unified identity
2. **Federated OA discovery** — 13 external sources searched alongside local catalogue
3. **AI librarian** — conversational interface with multi-provider fallback
4. **Thesis supervision** — student → supervisor → committee → approved chain
5. **Student engagement** — blog, events, forum, CMS, wellbeing in one platform
6. **QR digital library card** — generated and exportable
7. **Worker automation** — 11 job types with retries and health monitoring

## Top Remaining Engineering Gaps

1. **Circulation desk UI** — checkout, check-in, renew, holds queue
2. **MARC cataloguing depth** — frameworks, validation, batch mod, overlay
3. **Authority control** — CRUD, linking, merge, external lookup
4. **Acquisitions depth** — receiving, encumbrance, claims, EDI
5. **Repository workflow UI** — visual workflow management
6. **Multi-file upload UI** — drag-drop, roles, access levels
7. **Preservation dashboard** — fixity status, incidents, recheck
8. **OAI external validation** — independent harvester test
9. **SRU CQL wiring** — connect parser to endpoint
10. **Z39.50 real client** — YAZ/ZOOM integration
11. **AI tool use** — catalogue, repository, circulation actions
12. **Analytics event capture** — wire recordEvent to UI
13. **Notice wiring** — connect content to delivery
14. **Report UI** — connect writer to interface
15. **KBART fix** — resolve 500 error
16. **i18n wiring** — connect strings to UI
17. **Backup/DR** — automated backups, restore testing
18. **Performance testing** — load tests, p99, synthetic data
19. **API documentation** — OpenAPI, full route docs
20. **Storage abstraction** — unified interface, cleanup
