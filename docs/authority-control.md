# Authority Control — Pre-Change Audit

## Current State

### Schema
```sql
CREATE TABLE authority_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  term_type text NOT NULL CHECK (term_type IN ('author','subject','series','corporate','geographic')),
  variants text[] DEFAULT '{}',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Linking
- `catalogue_items.authority_id` (uuid, no FK) — single authority per item
- `catalogue_items.authority_heading` (text) — denormalized copy
- No per-author/per-subject linking
- No many-to-many relationship

### API
- `GET /api/authorities` — list all terms
- `POST /api/authorities` — link item to authority
- No POST for creating terms (done via direct Supabase client in UI)

### UI
- `CatalogueAuthorities.tsx` — CRUD for authority_control terms
- Usage counting via ILIKE on authors/subjects

### What's Missing
1. Authority types: PERSON, CORPORATE_BODY, MEETING, TOPIC, GEOGRAPHIC, UNIFORM_TITLE, GENRE_FORM
2. Preferred heading, see references, see-also relationships
3. External identifiers (VIAF, ORCID, LCNAF, ROR)
4. Authority merge with dependent relinking
5. Per-authority bibliographic linking (many-to-many)
6. Autocomplete search in cataloguing UI
7. External authority lookup (VIAF, LC, ORCID, ROR)
8. Authority audit/history
9. Link/unlink/relink operations
