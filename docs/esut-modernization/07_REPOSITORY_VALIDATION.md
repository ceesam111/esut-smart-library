# ESUT Virtual Library — Repository Validation (T01/T06 records)

## Public record resolution

| Check | Method | Result |
|---|---|---|
| Approved items resolve to public landing pages | Code audit of catch-all `app/[...slug]/page.tsx` + `getPublicRepositoryItem` gate | PASS (code): `status=published AND visibility=global AND not embargoed`; non-public → `noindex, follow` metadata, no JSON-LD |
| Unique stable URL | Canonical = immutable item UUID (`/repository/<uuid>`), emitted in metadata and repository sitemap | PASS (code) |
| OAI handle URLs still resolve | Catch-all joins multi-segment handles (`/repository/esutir/2026/…`) then canonicalizes to UUID | PASS (code); live HTTP 200 check = production verification item |
| Thesis records public | `/api/theses` + `/theses/<id>` behind `status='published'` gate; patron names via service-role embed only | PASS (code); unit tests cover gate + PII strip |

## Metadata completeness

- Required public metadata (title, authors, abstract, type, year, language, keywords, license, DOI when present) carried through `ScholarlyItem` → Highwire tags + JSON-LD. Audit found no payload leakage of `status`/`visibility`/`embargo` fields.
- `citation_pdf_url` emitted only for public `https://` PDFs (signed/token URLs rejected). Currently no public PDFs → tag absent; correct behavior, listed as content-supply dependency.
- Metadata completeness KPI (≥95% of approved records) **cannot be measured offline** — the T05 diagnostics endpoint now reports "missing metadata on public items" so the KPI becomes measurable once GSC/diagnostics run against production.

## Citation export validation

- BibTeX: entry types mapped (phdthesis/inproceedings/incollection/techreport/article); braces/backslashes and CR/LF neutralized; test asserts no forged `AU` line can be introduced (export-integrity defense).
- RIS: TY/AU/TI/PY/DO/UR/AB/KW/DP/LA/PB/ER present; newline injection flattened; tests assert tag integrity.
- Both exports parse-shaped (tests assert structure) — external parser validation (BibTeX/RIS tooling) remains a production smoke-test item.

## Usage-count caveat (pre-existing)

Browser anon `view_count`/`download_count` updates on `repository_items` were already ineffective under RLS before this pass (no anon UPDATE policy existed). Counts are therefore not trustworthy usage signals; recommend routing counters through a service-role API before T08 analytics are trusted. Recorded in `02_ESUT_GAP_MATRIX.md` T08 row.

## Content-supply dependencies

- Theses corpus: publication happens via committee workflow; the public list shows only workflow-published theses. Any historical theses must be imported/published by librarians (moderation INSERT policy permits staff bulk import with any status).
