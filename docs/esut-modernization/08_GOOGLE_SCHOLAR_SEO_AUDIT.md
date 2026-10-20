# ESUT Virtual Library — Google Scholar & SEO Audit (T02)

## Implemented (verified by code audit + tests)

| Requirement | Implementation | Evidence |
|---|---|---|
| Highwire citation tags | `citation_title`, `citation_author` (array), `citation_publication_date`, `citation_publisher`, `citation_language`, `citation_keywords`, `citation_doi`, `citation_issn`, `citation_pdf_url` (gated) | `scholarlyMetadata.ts:105-139`; `publicThesis.test.ts` metadata assertions |
| Schema.org JSON-LD | `ScholarlyArticle` default; `@type: Thesis` for thesis items; `isAccessibleForFree: false` when no public file; `</script>` breakout blocked via `<` escaping | `scholarlyMetadata.ts:62-69,182-184`; tests |
| Canonical URLs | `<link rel=canonical>` from `metadataBase` + immutable UUID paths; OAI handle URLs consolidate via canonical | audit §A |
| XML sitemaps | Index (`/sitemap.xml`) → static + repository + catalog + theses children; `force-dynamic` + cache headers | audit verified routes and columns |
| robots.txt | App-generated; disallows admin/dashboard/supervisor/reset-password, submit/status forms, and query-string faceted URLs (`?` literal semantics); `/theses?<id>` and `/repository?<id>` detail pages remain crawlable | `app/robots.ts`; audit §A |
| Crawl-trap avoidance | Faceted URLs with query strings get `x-robots-tag: noindex, follow` (middleware exact-path match — detail pages never noindexed) | audit verified scope |
| Login walls | Public metadata never requires auth; files withheld, not pages | gates on all public routes |

## Honest limitations

- **Google Scholar indexing is not guaranteed and is not claimed.** Scholar inclusion additionally requires searchable, properly-licensed PDFs and its own recrawl; the platform now satisfies the *technical readiness* half.
- `citation_pdf_url` is absent until public PDFs are supplied through the repository.
- **Google Search Console property not configured** (institutional action: webmaster verification of `virtuallibrary.esut.edu.ng`). Until then, index-coverage reporting happens via T05 diagnostics only.
- Duplicate thin pages: the old `/thesis` portal now renders real data via `/api/theses`; `/theses?...` faceted URLs are noindexed; `/catalogue?...` likewise — residual duplicate risk is low but should be confirmed in GSC coverage once connected.
- Webometrics ranking outcomes depend on policy, content and recognition — no ranking improvement is claimed or guaranteed.
