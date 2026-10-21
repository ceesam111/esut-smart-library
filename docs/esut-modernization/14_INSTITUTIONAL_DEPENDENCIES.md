# ESUT Virtual Library — Institutional Dependencies & Required Actions

Nothing below can be completed by the development team alone.

## Blocking / high priority

| # | Action | Owner | Why |
|---|---|---|---|
| 1 | **Approve & apply** `supabase/migrations/20261011130000_rls_escalation_fixes.sql` in the hosted Supabase project (rollback: `supabase/migrations/rollback/20261011130000_rls_escalation_fixes.down.sql`) | ESUT Library + Supabase owner | Closes self-publish escalation, audit forgery, versions leak; **until applied these gaps are live** |
| 2 | Verify `virtuallibrary.esut.edu.ng` in **Google Search Console** and grant the library team access | ESUT ICT / webmaster | T05 index-coverage reporting; sitemap submission. **Status 2026-10-21:** verification file `public/google34e078cbadc624f4.html` is committed (`c1f4394`) and live (HTTP 200, exact content match) on production — the remaining owner step is clicking **Verify** in GSC, then submitting `https://virtuallibrary.esut.edu.ng/sitemap.xml` under Sitemaps. The file must stay in `public/` permanently. |
| 3 | Set production env: `OAI_ENABLED=true`, `OAI_TOKEN_SECRET=<random>`, confirm `APP_BASE_URL`/`NEXT_PUBLIC_APP_BASE_URL` = `https://virtuallibrary.esut.edu.ng` | ESUT ICT / ops | OAI endpoint + canonical/sitemap/robots correctness silently depend on these |
| 4 | Rotate the exposed GitHub PAT; complete Resend DNS verification; decide Turnstile enablement | ESUT ICT | Standing security items from the deployment report |

## Content & policy (Library / Research Directorate / Senate)

- Deposit & copyright policy: approved-content definition, takedown procedure, embargoes — gates the KPI "every submission has rights approval".
- Publish or import historical approved theses/publications (staff moderation INSERT allows any status; bulk import via admin Migration tool).
- Supply public PDFs for approved items (enables `citation_pdf_url` → Scholar readiness).
- Restore drill: schedule + document one successful test restore of the Supabase database + B2 storage (T10 acceptance "documented successful restore test").
- Backup encryption configuration evidence (Supabase point-in-time recovery settings).

## Optional integrations (decide + fund)

- DOI registration via an authorized agency (current minting is Zenodo-fallback).
- `SEMANTIC_SCHOLAR_KEY` (T11 recommendations), Discourse SSO community, AI gateway key.
- ORCID profile-level linkage + deduplication tooling (T04).
- Journal/OER cross-linking program (T09).
- CWV monitoring (RUM or CrUX) subscription/keys (T12).

## Explicit non-claims

- Google Scholar indexing is not guaranteed; only technical readiness was implemented.
- No Webometrics ranking improvement is promised.
- Availability ≥99.5%, MFA for privileged users, and malware scanning depend on hosting/Supabase configuration that cannot be verified from the repository.
