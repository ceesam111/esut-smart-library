# SRU (Search/Retrieve via URL) — Audit and Implementation

## Pre-Change State (Batch 10 Starting Point)

### Route
- **Path:** `/api/sru`
- **HTTP Method:** GET only
- **Operations:** `explain`, `searchRetrieve`

### CQL Parser
- **Status:** EXISTS but NOT WIRED to the SRU route
- **Location:** `src/server/interoperability/cqlParser.ts`
- **Implementation:** Hand-rolled regex-based parser (no npm dependency)
- **Supported indexes:** dc.title, dc.creator, dc.subject, dc.description, dc.publisher, dc.date, dc.identifier, bath.isbn, bath.issn, bath.name, bath.title, bath.subject, keyword, identifier
- **Supported operators:** `=`, `any`, `all`
- **Supported boolean:** AND, OR
- **No parentheses support**
- **No `not` boolean**
- **No `exact` relation**
- **No sortBy support**

### SRU Route Query Handling
- **Does NOT use CQL parser**
- Passes raw query string to Postgres `websearch_to_tsquery` via `.textSearch('search_vector', query, { type: 'websearch' })`
- Index names in query are IGNORED

### Explain Response
- **Implemented:** Yes
- **Version advertised:** 1.1 (should be 1.2)
- **Indexes advertised:** 3 (anywhere, title, author) — but NOT actually used in search
- **Schemas advertised:** Only `info:srw/schema/1/dc`
- **Config:** default numberOfRecords=25, maximumRecords=100

### searchRetrieve
- **Implemented:** Yes
- **Query:** Raw string to websearch_to_tsquery (no CQL parsing)
- **Record schema:** Only Dublin Core
- **Pagination:** startRecord, maximumRecords, nextRecordPosition
- **No recordPacking support**
- **No sortBy support**

### Diagnostics
- **Partial:** Only unknown operation (diagnostic 1) and database error (diagnostic 6)
- **Missing:** malformed CQL, unsupported index, unsupported relation, unsupported schema, invalid startRecord, invalid maximumRecords, missing query

### Tests
- **File:** `app/api/sru/route.test.ts` (21 lines)
- **Quality:** Trivial — string-matching assertions against hardcoded XML, does NOT import or exercise the actual route

### UI Consumers
- **None**

### Feature Flags
- **`SRU_ENABLED`:** Documented in `docs/api.md` but never read in code

## Target State (SRU 1.2)

### Operations
- `explain` — full server description
- `searchRetrieve` — CQL query with pagination

### CQL Support
- Indexes: cql.serverChoice, dc.title, dc.creator, dc.subject, dc.identifier, bath.isbn, bath.issn, bath.name, rec.identifier
- Relations: =, exact
- Boolean: and, or, not
- Parentheses: supported

### Record Schemas
- MARCXML (`info:srw/schema/1/marcxml`)
- Dublin Core (`info:srw/schema/1/dc`)

### Diagnostics
- All standard SRW diagnostics for client errors

### Pagination
- startRecord, maximumRecords, nextRecordPosition
- Enforced maximum page size
