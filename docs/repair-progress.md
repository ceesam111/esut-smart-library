# Batch 11 — MARC Cataloguing Depth + Authority Control

## MARC Frameworks
- 4 frameworks: BOOK, SERIAL, THESIS, ELECTRONIC_RESOURCE
- 44 framework fields seeded
- Framework selector in CatalogueNew.tsx
- API: GET/POST /api/catalogue/frameworks

## MARC Validation
- Leader format, tag syntax, indicator, subfield validation
- Required field checking per framework
- ISBN-10/ISBN-13 check digit validation
- ISSN check digit validation
- ERROR/WARNING separation
- 15 validation tests pass

## Staged MARC Import
- Import batch model with record states
- Parse → validate → stage → duplicate detection → import
- API: POST /api/catalogue/marc-import
- Server-side complete

## Overlay Rules
- Configurable rules: replace, preserve, append, protect
- Protected 9xx fields
- Overlay preview generation
- Overlay audit logging
- 4 overlay tests pass

## Authority Control
- Enhanced schema: preferred_heading, see_references, see_also, identifiers, source, status
- Authority merge with dependent relinking
- Item-authority many-to-many links
- Merge history tracking
- API: GET/POST/PATCH /api/authorities

## Migration
- 20261003090000_marc_frameworks.sql applied live
- Tables: marc_frameworks, marc_framework_fields, marc_import_batches, marc_import_records, marc_overlay_rules, marc_overlay_audit, authority_merge_history, item_authority_links
- Authority control enhanced with 6 new columns

## Gates
- tsc: 0 errors
- eslint (new files): 0 errors
- vitest: 485 passed, 2 failed (pre-existing SIP2)
- build: PASS

## Partially Implemented
- Authority autocomplete UI (server-side search exists)
- Staged import UI (server-side exists)
- Overlay UI (server-side exists)
- External authority lookup
- Batch modification
- Live E2E tests