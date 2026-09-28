# Current DSpace Comparison — ESUT Repository vs DSpace 10

Evidence-based competitive audit. Every ESUT claim verified from current code, schema, tests and live endpoints; DSpace side from official DSpace 10 release documentation and documentation.dspace.org.

## Versions Compared

- Comparison date: 2026-09-28
- **DSpace baseline: 10.0** (released June 2026; Java/Spring Boot 8 + Angular UI; 9.3 also current; 7.6.x LTS extended support ended Jul 2026)
- **ESUT commit: `2625abb`** (live https://virtuallibrary.esut.edu.ng)
- Method: source + migration + route + test inspection, live endpoint probes, hosted-DB inspection. `docs/implementation-progress.md` claims treated as unverified.

Status legend: AHEAD · PARITY · BEHIND · PARTIAL · UNVERIFIED · EXTERNAL-CREDENTIALS REQUIRED · NOT APPLICABLE.

**Scope note:** DSpace is an IR (with DSpace-CRIS config). ESUT is ILS + IR + CRIS. Sections marked with (CRIS) compare against DSpace-CRIS capability; ESUT's ILS-only features are out of DSpace scope and noted as such.

## Section A — Capability Matrix

### 1. Items, Bundles, Files

| Capability | ESUT | DSpace | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Item model | `repository_items` single row + single `file_url` | Item → **Bundles → Bitstreams**: multiple files per item, per-bundle primary bitstream | **BEHIND** | `repository_items` schema; no `bundles`/`bitstreams` tables | **Multi-file deposit impossible** — the most fundamental IR gap | Canonical object/file model (already flagged `[ ]` in WAVE 1 of implementation-progress) | **P0**: bundles/bitstreams tables + upload flow |
| File storage | Public Supabase Storage buckets `repository`, `theses` (uploads); B2 endpoint routes exist but **frontend never calls them** | Local/SDS/S3/C/Google storage with proven bitstream pipeline | **PARTIAL** | `B2Service.ts` unused; bucket public=true | Two storage paths, none production-proven; public buckets leak embargoed files (Section K) | Private bucket + signed URLs + B2 wiring or removal | **P0** |
| Embargo | `embargo_until` column + API gate; **does not gate OAI** (see §4); UI passes `embargo_until` into a blob that never persists | Embargo at bitstream level, honored by discovery + harvesting + access | **PARTIAL** | `ListRecords` probe: embargo filters not applied in OAI query | No bitstream-level embargo; enforcement only in one API path | Enforce in OAI/download paths | P1 |
| File formats/sizes/mime/extension | Basic metadata on single file | Format metadata, single-file check, size limits, MIME detection | **PARTIAL** | upload route validation | — | Format registry | P2 |

### 2. Metadata

| Capability | ESUT | DSpace | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Metadata schema | Fixed column set + `metadata` JSONB bag | **Dublin Core (qualified) registry**, pluggable crosswalks, schema registry UI | **PARTIAL** | `repository_items` columns + JSONB | ESUT extensible via JSONB but unregistered/untyped | Metadata registry + form builder | P2 |
| Forms/validation | Client-side required fields | Configurable submission forms (steps, validators, vocabularies, authority) | **BEHIND** | `RepositorySubmission.tsx` hard-coded | No server-side validation beyond NOT NULL | Server-side field validation | P1 |
| Batch metadata editing | ABSENT | Batch edit w/ preview | **BEHIND** | — | — | — | P3 |
| Duplicate detection | ABSENT (bibliographic duplicates only, catalogue side) | Duplicate detection on submit (DSpace 8+) | **BEHIND** | — | — | — | P3 |

### 3. Deposits / Workflows

| Capability | ESUT | DSpace | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Submission workflow | Simple statuses `pending/rejected/published/embargoed` + `reviewer_id`; deposit UI → row insert | **Workflow service**: editable stepwise review (claim/return/unclaim), multiple collection roles, configurable actions | **PARTIAL** | `ir_submission_status` + `RepositorySubmission.tsx`; `/api/repository/review` | DSpace review is a state machine with audit; ESUT is a status flip | Return-to-author, claim, step audit | P1 |
| Supervised submission | Working thesis chain: student submit → supervisor review (`/api/repository/supervisor-review`) → librarian approve → publish | Achievable via DSpace-CRIS workflows but not native "supervisor" role | **AHEAD (native)** | `repository_supervisor_review` routes + tests | Genuinely beyond stock DSpace | — | — |
| Reviewer permissions | Per-collection (`repository_collections.reviewer_id`, per-collection reviewer flag) | Collection workflow roles | **PARITY (concept)** | collection schema | — | — | — |
| Versioning | `repository_versions` table + version-list UI; **only v1 ever written by code**; placeholder test `versions.test.ts` with no assertions | Full version history: new versions of item, patching, versioning UI, all versions discoverable | **PARTIAL** | `versions.test.ts` empty; WAVE 2 admits `[ ] versioning placeholder test` | DSpace: production versioning; ESUT: scaffold | Wire create-version on edit; real tests | P1 |
| SWORD | **Service document only** (`/api/sword/service-document`); no deposit endpoint, no frontend | SWORD v2: full deposit, edit, packaging (atom+xml, zip) | **PARTIAL** | `sword/*` routes (2) | DSpace SWORD is validated by community; ESUT is a shell | SWORD deposit endpoint | P2 (partner requirement dependent) |

### 4. Harvesting & Export

| Capability | ESUT | DSpace | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| OAI-PMH | **Live** (Identify/ListIdentifiers/ListRecords/oai_dc; p50≈360ms). `deletedRecord=no`. **Production returns 0 records** (DB: `repository_items`=0). Filters ignore embargo & per-item visibility. Q1 `header` double-wrap bug (code) | Core DSpace feature: many metadata formats (oai_dc, dim, METS, MODS, QDC…), `deletedRecord=persistent`, harvest config UI, batch resumption | **PARTIAL** | live `LIST_RECORDS records=0 len=455`; `oai/route.ts` WAVE-1-noted bugs persist | Endpoint deployed but harvests an empty, format-limited set; **never validated by an external harvester** (LEVEL 4, not 5) | Add embargo/visibility to query; fix double-wrap; `ListSets` from collections; metadata formats | **P1** |
| ResourceSync | Builders `buildResourceSync()` + test exist; **zero endpoints/callers** | DSpace delivers ResourceSync (zipped manifests) | **PARTIAL (unwired)** | grep: only test imports | Doc claimed "Deployed" — **false** | Expose `/api/resourcesync` | P1 |
| Sitemaps | Live `/sitemap.xml` (149 items) | DSpace sitemap index | **PARITY** | live probe 200 | — | Add items when repo has data | — |
| Signposting | `buildSignposting()` builders only, **no Link headers served anywhere** | DSpace signposting (FAIR) | **PARTIAL (unwired)** | grep: test-only | Doc claimed "Deployed" — **false** | Add Link headers to item API | P1 |
| CSV export | Working CSV export endpoint | Collection/item export | **PARITY (concept)** | `export/csv` + tests | — | — | — |
| JSON-LD / RDF | `context.json` file + `application/ld+json` type on one route | COAR-notify JSON-LD context + item JSON-LD via REST | **PARITY (concept)** (shallow both) | `context.json` | — | Per-item JSON-LD doc | P2 |

### 5. Discovery

| Capability | ESUT | DSpace | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Search engine | Postgres GIN tsvector + `websearch_to_tsquery`; **client-side facets** (no server counts) | **Apache Solr**: full-text (Tika PDF extraction), faceting with counts, spellcheck, relevance, OpenSearch | **BEHIND** | FTS migration; `localSearch.ts` facets computed client-side | DSpace search quality vastly deeper; full-text content search absent | Server-side facets; content extraction (pdf.js server side) | P1 |
| Google Scholar / SEO | Sitemap + robots; **no Scholar tags** (highwire/citation meta), no per-item canonical/OG | DSpace emits Google Scholar (highwire press), Dublin Core citation tags, canonical URLs, sitemap per collection | **PARTIAL** | `robots.txt`, sitemap only | Scholar indexing impaired | Add citation meta tags to item pages | P1 (research visibility) |
| Federated discovery | **14 external OA adapters in-process** (OpenAlex, Crossref, DOAB, DOAJ, Unpaywall…) across catalogue + repository | DSpace federated search is plugin/extension territory (External Search plugins); stock = own Solr | **AHEAD** | `src/server/resources/adapters.ts` | Real differentiator for a university IR — but owner reports production search only returns OpenLibrary (#4) | Fix multi-source behavior before claiming | **P1** |
| Browse (author/subject/date) | Basic lists + authority tags | Browse by author/title/subject/date with faceted counts, ORCID-enabled | **PARTIAL** | browse routes | No counts, no authority browse | Server-side browse | P2 |

### 6. Access Control

| Capability | ESUT | DSpace | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Item permissions | `visibility public/campus/private` + `requireRole` server checks; **RLS = 125/125 tables enabled, 0 policy-less (live)** | Resource policies per object (READ/WRITE/REMOVE) per group, item-level + bitstream-level, admin UI | **PARTIAL** | live DB audit; `requireRole` (115 uses) | 3 coarse states vs per-object policies; single-file model limits granularity | Per-object policy rows for repository | P2 |
| Groups | `access_groups`/`access_group_members` | Hierarchical groups (Administrator/Reviewer/EndUser/Anonymous per collection) | **PARTIAL** | group tables + `/api/repository/access-groups` | No auto-assignment on collection join | Collection-scoped groups | P2 |
| Auth providers | Supabage email + Google OAuth; Turnstile disabled | OIDC/SAML/LDAP/Shibboleth + password | **BEHIND** | `.env` providers | Institutional SSO missing | SSO | P1 |
| Embargo enforcement | See §1 — not applied in OAI | Full enforcement incl. harvest | **BEHIND** | OAI probe | — | — | P1 |

### 7. Preservation

| Capability | ESUT | DSpace | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| AIP export | **`exportItemAIP()` writes a `.txt` pseudo-bag** (README, tagmanifest, description inside; **no payload copy**); AIP bucket name in code | Real AIP via CopyTask: original + metadata + checksums, storage segregation, standard | **PARTIAL (mislabeled)** | `preservation/aip.ts` WAVE-2 not-done flag persists in doc | Doc claimed "AIP export" complete — overstated | Real zip-based AIP with payload | P1 |
| Fixity | SHA-256 captured on upload; `runFixityVerification()` query exists — **zero scheduled callers**; "periodic verify job" claim false | Checksum history + scheduled fixity checks (ChecksumHistory, fixity events) | **PARTIAL** | grep `runFixityVerification` → test only | Claims overstated | Scheduler task calling the query (idempotent) | P1 |
| BagIt/RO-Crate | builders + tests (bag, ro-crate) — no delivery route | DSpace 9+ RO-Crate export on items | **PARITY (concept, unwired)** | `preservation/{bagit,rocrate}.ts` | Both code-only vs user-facing | Expose download routes | P2 |
| Withdrawal/tombstone | **No withdraw** (delete row = hard delete possible?) — only visibility flips | Withdraw with tombstone, reinstate | **BEHIND** | no withdraw routes | Lose archival trail on delete | Soft-delete + tombstone | P1 |
| LOCKSS/external preservation | ABSENT | Plugin territory | NOT APPLICABLE | — | — | — | — |

### 8. CRIS (against DSpace-CRIS / 10.0)

| Capability | ESUT | DSpace 10 / DSpace-CRIS | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Entities | `researchers`, `researcher_profiles`, `researcher_grants`, `researcher_departments`, `researcher_publications` + JSONB author links | DSpace-CRIS: ORCID/ROR/FunderRegistry entities, relation graph, widgets | **PARTIAL** | CRIS tables + research pages | DSpace-CRIS is registry-backed; ESUT is bespoke with **two researcher models** (`patrons` vs `researchers`) | Unify researcher identity; ORCID claim check | P1 |
| Publications metadata | repository JSONB + catalogue MARC | CRIS publication entity + external sync (Crossref/DOI) | **PARTIAL** | — | No DOI-driven autofill (Zenodo path only) | Metadata fetch from Crossref on DOI paste | P2 |
| Grants | `researcher_grants` table, no UI found | CRIS grants | **PARTIAL** | table only | — | Grants UI | P3 |
| Thesis chain | Full: submit → supervisor → approve → publish with `thesis_supervisors` | Achievable but non-native | **AHEAD (native)** | supervisor-review routes + tests | Differentiator | — | — |

### 9. Identifier Management

| Capability | ESUT | DSpace | ESUT status | Evidence | Maturity difference | Remaining gap | Recommended action |
|---|---|---|---|---|---|---|---|
| Handles | `handle` column (prefix configured?) — **no handle server integration found**; repo IDs are internal `ir-…` | Handles.net / local Handle Server (global identifiers, resolvable) | **PARTIAL (UNVERIFIED)** | handle column present; no handle server route | No global resolvable identifier → citation links unstable | Handle registration or DOI-only path | P1 |
| DOI | Zenodo deposit minting (credential-gated) | DataCite DOI integration + mediation | **PARITY (concept)** / EXTERNAL-CREDENTIALS REQUIRED | Zenodo routes (env-gated) | Both are external-minter dependent | — | — |
| ORCID/ROR | Public lookup proxies exist (`/api/cris/orcid`, `/api/cris/ror`) — **zero UI callers** | ORCID sync, ROR org lookup native | **PARTIAL** | grep callers → 0 | Unwired | Wire into researcher/publication forms | P2 |

### 10. Integrations & Standards (cross-section; see also Section E)

| Capability | ESUT | DSpace | ESUT status | Evidence | Remaining gap |
|---|---|---|---|---|---|
| COAR Notify | Inbox route **accepts unauthenticated POSTs → 201** (proven live; probes deleted), 2 types (Approve/Endorsement) | DSpace COAR-notify inbox (agent-based, signature verification via DSpace 9+) | **PARTIAL + SECURITY HOLE** | live `COAR_POST3 status=201` | requireRole on inbox; signature verification; vocabulary validation |
| Webhooks | `repository_webhooks` outbox w/ tests | DSpace events/webhooks (limited) | **PARITY (concept)** | webhook outbox + tests | — |
| Subscribed resources | Directory of 7 subscribed databases (fixed) + overlay (this session) | External Search / finder plugins | **AHEAD (small)** | directory feature (ee27bd8/df7b165) | Deep-link search APIs where supported |
| IIIF | ABSENT | DSpace IIIF (via addons/config) | BEHIND | — | P3 |
| Usage statistics / COUNTER | `analytics_events` empty (recordEvent unwired); **COUNTER display unwired** despite builder; SUSHI endpoint **absent** (doc claim false) | COUNTER-validated stats, SUSHI harvester | **BEHIND (claimed AHEAD is false)** | eventRecorder 0 callers; no `/api/sushi` | Wire analytics; COUNTER Report checkbox; SUSHI | P1 |
| Notifications | Cross-module notification UI works; email channel = Resend (blocked: domain unverified) | DSpace in-app + email notifications | **PARITY (concept)** | notification tables + Resend blocker | Email needs verified domain | — | — |

## Section C — Five ESUT advantages vs DSpace (verified)

1. **Full ILS operations alongside the repository** (circulation, patrons, acquisitions, serials, fines) — DSpace is IR-only. Caveat: ILS side has owner-reported broken flows (#13/#14).
2. **Native thesis supervision workflow** (student → supervisor → librarian → publish) without extra modules.
3. **14-source federated scholarly discovery** in-process across catalogue + IR — beyond stock DSpace search — *caveat: production behavior currently broken (#4)*.
4. **AI reference librarian + 7 typed worker agents** with a DB-backed queue — no DSpace equivalent — *caveat: workers reported failing (#19)*.
5. **QR-first patron engagement platform** (digital library card, blog, events, forum, wellbeing) in the same identity layer — outside DSpace's product scope.

## Section D — Five DSpace advantages over ESUT (verified)

1. **Multi-file object model** (bundles/bitstreams) vs ESUT single `file_url` — blocks multi-format deposits entirely.
2. **Search & discovery depth** (Solr, full-text extraction, faceted counts, Scholar tags) vs client-side facets over one table.
3. **Preservation pipeline** (real AIP payload, scheduled fixity, checksum history, withdraw/tombstone) vs pseudo-AIP `.txt` and unwired fixity.
4. **Workflow engine** (stepwise review with claim/return/unclaim/audit) vs a status column.
5. **Metadata/harvesting ecosystem** (schema registry, multiple OAI formats, ResourceSync, SWORD deposit, SUSHI/COUNTER) — ESUT's are shells or single-format.

## Summary — DSpace

**ESUT is BEHIND DSpace 10 on every core IR dimension** (files, metadata, workflow, preservation, discovery, standards breadth), while holding scope advantages DSpace doesn't attempt (ILS + supervision + AI + engagement). Priority for IR parity: **bundles/bitstreams model → server-side facets/Scholar tags → real AIP + scheduled fixity → withdraw/tombstone → OAI fixes + ResourceSync/Signposting wiring → COAR inbox auth**.
