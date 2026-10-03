# MARC Cataloguing — Pre-Change Audit

## Current State

### MARC Storage
- `catalogue_items.marc21_fields` (jsonb) — structured MARC fields
- `catalogue_items.marc21_leader` (text) — leader string
- `catalogue_items.marc21` (jsonb) — legacy, unused

### MARC Data Structure
```json
{
  "leader": "00000nam a2200000 i 4500",
  "100": { "ind1": "1", "ind2": " ", "subfields": { "a": "Author" } },
  "245": { "ind1": "1", "ind2": "0", "subfields": { "a": "Title" } }
}
```

**Critical limitation:** Object keyed by tag — repeatable tags (650, 700, 500) overwrite each other.

### MARC Editor UI
- `CatalogueNew.tsx` — 33 tag definitions, field-by-field editor
- Simple mode: flat form → `syncSimpleToMarc()` → `buildMarc21()`
- Advanced mode: direct MARC21 editing

### MARCXML
- `marcXml.ts` — regex-based parser (fragile), `itemToMARCXML()` serializer
- `marc.ts` — clean MARC data model (orphaned, not used by UI)
- Export: client-side from flat columns, not from `marc21_fields`

### Z39.50 Import
- YAZ-based client → `parseMarcRecord()` → fills simple form → `syncSimpleToMarc()` → `buildMarc21()`
- Does NOT write directly to `marc21_fields`
- Loses repeatable tags

### Duplicate Detection
- ISBN exact match → STRONG_MATCH
- Title ILIKE → POSSIBLE_MATCH
- No fuzzy matching, no author+title combination

### What's Missing
1. Repeatable MARC tags (650, 700, 500)
2. MARC import endpoint (MARCXML/ISO2709)
3. Proper XML parser
4. MARC validation engine
5. Staged MARC import workflow
6. Overlay rules
7. Batch modification
8. Authority control (per-author, merge, external lookup)
9. Framework-driven cataloguing UI
