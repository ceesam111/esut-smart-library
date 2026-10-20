# ESUT Virtual Library — Accessibility & Performance (T12)

## Accessibility (WCAG-aligned, code-level)

Implemented/verified on the new and changed pages:

- **Headings:** one `h1` per page; `h2`/`h3` order maintained (`ThesisDetail`, `ThesisListing`, `admin/Visibility`) — audit-verified.
- **Keyboard:** all interactive elements are native buttons/links/selects; expandable table rows toggle via row click and are button-like controls; citation style buttons expose `aria-pressed`.
- **Labels:** form inputs labeled; decorative icons `aria-hidden`; breadcrumb separators hidden from AT.
- **Status messages:** loading skeletons use `aria-busy`/`aria-live`; new error banners carry `role="alert"` (Visibility page, Thesis listing).
- **Skip link:** present site-wide (pre-existing component, audit-confirmed).
- **Language:** all new user-visible strings exist in both `en.ts` and `fr.ts` with identical structures (audit parity check).
- **Contrast/motion:** existing Tailwind design tokens retained (pre-existing audit surface; no new low-contrast combinations introduced).

Gaps (honest): no automated axe/Lighthouse run is claimable from this environment; no screen-reader user testing performed. Recommend a manual AT pass before the next public launch milestone.

## Performance

| Control | Status |
|---|---|
| Self-hosted fonts only (duplicate Google Fonts CDN `<link>`s removed from `app/layout.tsx`) | DONE |
| Cache headers: `public, max-age=60, s-maxage=300` (thesis list), `max-age=300, s-maxage=900` (thesis detail), `max-age=3600` (citation exports), cache headers on all sitemap routes | DONE |
| `force-dynamic` on metadata/sitemap/OAI routes (fresh scholarly data, cached at edge per headers) | DONE |
| Rate limiting on OAI + sensitive APIs (protects origin under crawler load) | DONE |
| Middleware matcher excludes static assets | pre-existing |

Gaps (honest):

- **Core Web Vitals are not instrumented** — no RUM/CrUX reporting exists. Baseline LCP/CLS/INP for mobile must be measured post-deployment (institutional/ops step; needs Search Console or a monitoring key).
- Heavy client-SPA shell means metadata is server-rendered but body content hydrates client-side — acceptable for now; server-rendered listing fragments are a future improvement.
- Deep visibility check can take up to ~125 s worst case (25 × 5 s) — admin-triggered only, UI shows progress.

Availability ≥99.5% and backup monitoring are hosting-level commitments (Coolify/VPS) — see `13_DEPLOYMENT_ROLLBACK_PLAN.md` and `14_INSTITUTIONAL_DEPENDENCIES.md`.
