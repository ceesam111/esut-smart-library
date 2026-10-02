# Standards Conformance

## OAI-PMH 2.0

| Requirement | Status | Evidence |
|---|---|---|
| Protocol version 2.0 | COMPLETE | `<protocolVersion>2.0</protocolVersion>` in Identify |
| Identify verb | COMPLETE | Config-driven repositoryName, baseURL, adminEmail, granularity, deletedRecord, earliestDatestamp |
| ListMetadataFormats | COMPLETE | oai_dc, datacite, marcxml |
| ListSets | COMPLETE | Stable setSpecs: type:*, faculty:*, department:* |
| ListIdentifiers | COMPLETE | Header-only records with setSpec per item |
| ListRecords | COMPLETE | Full metadata records for requested prefix |
| GetRecord | COMPLETE | Single record by OAI identifier |
| Resumption tokens | COMPLETE | Signed, expiring tokens with cursor/completeListSize/expiration |
| Date granularity | COMPLETE | YYYY-MM-DD and YYYY-MM-DDThh:mm:ssZ; rejects offsets |
| Error codes | COMPLETE | badVerb, badArgument, badResumptionToken, cannotDisseminateFormat, idDoesNotExist, noRecordsMatch, internalError |
| Embargo enforcement | COMPLETE | Embargoed items excluded from all list/count queries |
| Private item exclusion | COMPLETE | Only status=published AND visibility=global items exposed |
| XML well-formedness | COMPLETE | All verbs produce valid OAI-PMH 2.0 XML (tested) |
| Rate limiting | COMPLETE | 120 req/min per IP via in-memory sliding window |
| Observability | COMPLETE | oai_request_log table with verb, error_code, record_count, duration_ms |

## External Validation

| Check | Status | Notes |
|---|---|---|
| DNS resolution for esutlibrary.edu.ng | BLOCKED | Domain does not resolve (apex and www) |
| HTTPS endpoint reachable | BLOCKED | VPS returns 404 for /api/oai |
| OAI_ENABLED env var | BLOCKED | Not set in any .env |
| External validator (e.g. OAI-PMH validator) | BLOCKED | Cannot run without public endpoint |

**Maturity: LEVEL 4 / BLOCKED_EXTERNAL_VALIDATION**

The OAI-PMH implementation is complete and unit-tested but cannot be externally validated because the domain does not resolve and the endpoint is not publicly accessible. This is an infrastructure prerequisite, not a code defect.
