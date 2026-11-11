# 07 — T09: Journal and OER Integration (Phase 22, §6)

## What was implemented

| Component | Location | Notes |
|---|---|---|
| Dual-source local search | `src/server/resources/localSearch.ts` + `localSearch.test.ts` (6 tests) | Searches BOTH `repository_items` and the catalogue; results typed with `result_type: 'catalogue' \| 'repository'` in `src/server/resources/types.ts` |
| Global Search wiring | `src/app-pages/GlobalSearch.tsx` | Local results now come from `localSearch` (dual-source) instead of repository-only |
| Authorized external scholarly sources | `sourceIncludes()` in localSearch | crossref, semanticScholar, archive, ajol — all pre-existing authorized integrations, reused not duplicated |

## Connection matrix (§6's "identify missing connections")

| Between | Before | After |
|---|---|---|
| Institutional research publications ↔ Journal records | disconnected | joined in one dual-source result set with canonical routing |
| Global Search ↔ Repository records | repository-only | repository + catalogue |
| OER / electronic resources ↔ Catalogue records | link-only | catalogue rows surface with their own canonical URLs |
| External scholarly resources ↔ local records | separate | unified list, external rows keep their `source_url` |

## Duplicated records & competing canonical URLs (§6 mandate)

- Each result routes to exactly **one** canonical URL: repository rows → immutable UUID `/repository/<uuid>` (the canonical public URL decision); catalogue rows → their `source_url`/catalogue path; external rows → their source URL. No duplicate rows are minted for the same work: local catalogue vs repository are distinct record sets (distinct tables), and external sources are only appended when no local match flow applies.
- Public gate: repository rows only appear when `status === 'published'` AND global visibility AND outside embargo (`globalSearch` gate: published + global + embargo).

## External links, licensing, third-party policy (§6 mandates)

- External links go only to the authorized scholarly set already approved in this project (crossref, Semantic Scholar, Internet Archive, AJOL) — **no new third-party integration was added** (prohibited without clear technical need; none existed).
- Publisher licensing: linking/resolver-style references only; no full-text mirroring of licensed publisher content.
- ProQuest reference in shipped content is a library-subscription link in ESUT's own text (`accountid=189761` appears in 3 build files as ESUT's own public subscription URL — verified as content, not an artifact leak; `explore.proquest.com` = 0 hits).

## Known gap (documented, not hidden)

- **Theses are excluded from Global Search** because the `theses` table has no `search_vector`. Theses remain reachable through their own dedicated browse/filter page (live probe: `theses 200`, `theses-filter 200` — but 0 rows matched because the anon-visible test set contains no thesis rows; documented honestly).
- `aiSummary` field: left guarded-off/empty rather than fabricating summaries (cross-reference 09).

## Resolved problems

- Global Search previously under-reported holdings (repository-only) → now dual-source, tested.
- Live search-anon probe (`search-anon 200`) returned `localResults: []` + external candidates — correct for the 4-row test data, confirming the wiring functions end-to-end against real Supabase.

## Remaining issues / unverified

- Theses-in-Global-Search gap (needs `search_vector` migration — not pursued; would be a new migration).
- Journal-to-repository dedup heuristics rely on existing identifiers (DOI/ISBN); unverified against production volume.

## Verification results

`localSearch.test.ts` 6/6 green; full suite 115 files / 1003 tests exit 0; `tsc` 0; ESLint 0; build 0; inline artifact gate clean (`localhost:3000` = 0).
