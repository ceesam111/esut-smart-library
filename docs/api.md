# ESUT Smart Library — API Reference

Base URL: `https://esutlibrary.edu.ng`

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <supabase_access_token>
```

Public endpoints (OAI-PMH, SRU, federated search) do not require authentication.

## Repository

### GET /api/repository
List repository items (published + global + non-embargoed).

**Query params:** `q` (search), `department`, `limit` (max 100)

### GET /api/oai
OAI-PMH 2.0 data provider.

**Query params:** `verb` (Identify, ListMetadataFormats, ListSets, ListRecords, ListIdentifiers, GetRecord), `metadataPrefix`, `from`, `until`, `set`, `resumptionToken`, `identifier`

### GET /api/sru
SRU search/retrieve server.

**Query params:** `operation` (explain, searchRetrieve), `query`, `startRecord`, `maximumRecords`

### GET /api/repository/versions?item_id={id}
List versions for a repository item.

### POST /api/repository/versions
Create a new version for a repository item.

**Body:** `{ item_id, file_url, change_note }`

## Catalogue

### GET /api/catalog
Search catalogue items.

**Query params:** `q` (search), `limit` (max 100)

### GET /api/catalog/legacy/{id}
Get catalogue item by ID.

## Federated Search

### GET /api/search/resources?q={query}&expand={bool}
Search across local catalogue + 14 external sources (Open Library, Google Books, DOAB, DOAJ, OpenAlex, CrossRef, Internet Archive, CORE, Gutenberg, Standard Ebooks, PubMed, PMC, HathiTrust, Unpaywall).

## Identifiers

### POST /api/identifiers/mint
Mint a DOI or Handle.

**Body:** `{ action: "doi" | "handle", title?, creators?, year? }`

## Interoperability

### GET /api/licenses
List all licenses (ir_licenses).

### GET /api/authorities
List all authority records.

### POST /api/authorities
Link an authority to a catalogue/repository item.

**Body:** `{ item_type, item_id, authority_id, heading? }`

### GET /api/coar-notify/inbox
COAR Notify inbox (JSON-LD).

### POST /api/coar-notify/inbox
Receive COAR Notify notification.

### GET /api/sword/service
SWORD 3.0 service document.

### GET /api/ror?q={query}
Search ROR for organizations.

### GET /api/orcid?id={orcid_id}
Validate ORCID ID (server-side).

### GET /api/serials/kbart
Export serials in KBART format.

## Admin

### GET /api/admin/analytics?days={n}
Analytics summary (page views, searches, downloads, logins, registrations, top pages).

### POST /api/admin/reports/generate
Generate a report.

**Body:** `{ type: "circulation" | "acquisitions" | "repository" | "serials" | "fines", startDate, endDate, format: "csv" | "json" }`

### GET /api/admin/duplicates?type={isbn|title}
Find potential duplicate catalogue items.

### POST /api/admin/email/test
Test email configuration.

### GET /api/admin/email/status
Check email provider status.

## Circulation

### POST /api/circulation/notices
Send a circulation notice.

**Body:** `{ type: "overdue" | "due_soon" | "hold_available" | "receipt" | "fine", recipient_email, recipient_name, item_title, ... }`

### POST /api/circulation/offline-sync
Sync offline circulation transactions.

**Body:** `{ transactions: [{ offline_id, action, item_id?, patron_id?, ... }] }`

## Serials

### GET /api/serials/claims?serial_id={id}
List claims for a serial.

### POST /api/serials/claims
Create a claim for a missing issue.

**Body:** `{ serial_id, issue_number, volume?, notes? }`

### PATCH /api/serials/claims
Update claim status.

**Body:** `{ claim_id, status: "pending" | "notified" | "resolved" | "cancelled" }`

## Health

### GET /api/health/schema
Check database schema health.

## Feature Flags

| Flag | Default | Purpose |
|---|---|---|
| `OAI_ENABLED` | unset | Enable OAI-PMH provider |
| `SRU_ENABLED` | unset | Enable SRU server |
| `SWORD_ENABLED` | unset | Enable SWORD deposit |
| `Z3950_ENABLED` | unset | Enable Z39.50 gateway |
| `SIP2_ENABLED` | unset | Enable SIP2 server |
| `COAR_NOTIFY_ENABLED` | unset | Enable COAR Notify |
| `RESOURCESYNC_ENABLED` | unset | Enable ResourceSync |
