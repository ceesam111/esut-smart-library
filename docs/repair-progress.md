# Batch 10 — SRU + Z39.50

## SRU (Search/Retrieve via URL) 1.2

- CQL parser with boolean operators, relations, field mappings
- MARCXML and Dublin Core serialization
- SRW diagnostics (10, 11, 12, 13, 14, 15)
- Pagination with nextRecordPosition
- 49/49 tests pass
- Live E2E: 13/13 scenarios pass against localhost:3000
- Independent Python validation: PASS

## Z39.50 Client

- YAZ 5.34.0 via CLI (yaz-client, yaz-marcdump)
- BIB-1 attribute mapping (title=4, author=1003, subject=21, isbn=7, issn=8, keyword=1016)
- SSRF protection with trusted-target model
- Duplicate detection (NO_MATCH, POSSIBLE_MATCH, STRONG_MATCH)
- 32/32 unit tests pass
- Docker image built with YAZ installed
- Live verification: yaz-client in Docker against Library of Congress (151 hits, 2 records)

## Migration

- `20261002100000_z3950_targets.sql` applied live
- Tables: z3950_targets, z3950_search_audit
- 2 default targets seeded (Library of Congress, British Library)

## Gates

- tsc: 0 errors
- eslint (new files): 0 errors
- vitest: 466 passed, 2 failed (pre-existing SIP2 timeouts)
- build: PASS