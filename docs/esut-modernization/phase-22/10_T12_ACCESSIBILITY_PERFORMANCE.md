# 10 — T12: Accessibility and Performance (Phase 22, §9)

## Accessibility (target: WCAG 2.2 AA)

### Automated checks run (all green, in final 115-file/1003-test run)

- `src/lib/a11y.test.tsx` — accessible-name/role/label assertions over UI component renderings.
- `src/lib/i18n.component.test.tsx` — component render checks incl. notification/alert semantics (accessible notifications in §9 list).

### Manual procedures documented (automated tools cannot cover these)

Per §9 ("supplement automated checks with documented manual procedures"):

1. **Keyboard**: tab through header → search → catalogue → repository detail → forms; assert visible focus ring, logical order, no trap (Esc closes dialogs).
2. **Focus management**: after route change focus moves to page heading; after dialog close focus returns to trigger; errors focus the first invalid field.
3. **Screen reader**: announce search result counts, form validation errors (role=alert present — prior-phase fix retained), pagination state.
4. **Form validation**: every field has `<Label>` + error text tied via `aria-describedby`; required fields marked.
5. **Colour contrast**: text tokens checked against AA ratios (4.5:1 body, 3:1 large/UI) in the design tokens.
6. **Search accessibility**: results are a semantic list with per-result headings; `search-anon` response renders with type labels (catalogue/repository).
7. **Research-detail pages**: citation metas not exposed as UI; headings hierarchy single-H1.
8. **Download controls**: real `<button>`/`<a download>` with accessible names (file + type).
9. **Tables**: header cells marked; pagination controls labelled.
10. **Mobile navigation**: hamburger toggles expose `aria-expanded`; no hover-only actions.
11. **Responsive**: breakpoints from 360 px up; no horizontal scroll at 360 px (component-level checks).

Automated suites green + manual procedure documented; **no critical accessibility blocker found this phase** (the critical fixes were made in earlier phases and remain intact — regression batch green).

## Performance — measured before and after (no claims without measurement)

Method: identical measurement both sides — serve/inspect first-load assets referenced by the document's `<script src>`/stylesheet tags, uncompressed bytes (curl on this machine lacks `--compressed` support, so transfer-over-the-wire compressed sizes are **not claimed**).

### Production (live, old image `20261023-0259`) vs Phase 22 build

| Asset | Production | Phase 22 build |
|---|---|---|
| HTML document | 7,949 B | 7,007 B |
| JS chunks (initial set) | 8 chunks = 579,537 B | 8 chunks = 569,460 B (incl. one renamed chunk) |
| CSS | 192,519 B | 192,518 B |
| **Initial payload total** | **≈ 780 KB** | **≈ 769 KB** |

Per-chunk production values (evidence): `0cz1d0mv5g_q7` 112,594 · `19wg2q9r2_sev` 21,767 · `1lde47jk8w737` 5,011 · `23k1thx2x6-2c` 13,820 · `2e63yorbqukwm` 4,912 · `2tf-i9ll025ps` 180,358 · `3dmm3v_fq28gc` 229,820 · `turbopack-2c3mg3r-05n1w` 11,255 · CSS `1u--yfgxkq8oj` 192,519. (Two early measurement failures — a script-tag regex that matched 0 assets, and transient DNS/connect errors — were retried until all 9 assets were measured.)

Full static output of the Phase 22 build: 175 JS files / 5,482,562 B + 1 CSS / 192,518 B (route-level lazy chunks included; initial set above is what the home document loads).

### §9 performance checklist status

| Item | Status |
|---|---|
| Slow DB queries | no slow-query regressions introduced; searches covered by test suites; production query latency unmeasured (no APM) |
| Excessive API requests | Global Search now does **one** dual-source local call instead of separate repository/catalogue calls |
| Large JS bundles | measured above; initial payload ≈ −11 KB vs live; no bundle growth from Phase 22 features (changes are server-side + small client wiring) |
| Unnecessary re-rendering | client changes limited to result mapping; no render-path regression found in review |
| Inefficient search | dual-source server-side search; SRU/XSS inputs rejected at parse level (400s live) |
| Slow research landing pages | SSR HTML 7,007 B; item page SSR 11,922 B with full content live |
| Large metadata responses | citation/RIS/BibTeX responses tiny; `search-anon` response 202 KB for full result page (includes external candidates — documented, pageable) |
| Caching inefficiencies | static assets immutable-hashed; no cache regressions observed |
| Mobile network constraints | compressed transfer sizes **not measurable on this machine** (old curl); documented as unmeasured rather than estimated |

### Core Web Vitals

§9 says "use the current Core Web Vitals definitions" and "avoid claiming improvements without comparative measurements." Field CWV (CrUX) requires deployed-site GSC access → **unavailable**; therefore **no CWV improvement is claimed** — only the lab-level payload measurements above.

## Resolved problems

- Production bundle measurement initially failed twice (0-asset regex, DNS flakes) — resolved by extracting actual script tags and retrying until complete (evidence per chunk above).
- Performance regression risk from new features: eliminated — payload is slightly smaller, and artifact gate confirms no dev artifacts (`localhost:3000` = 0 across 2,228 files).

## Remaining issues / unverified

- Field CWV + compressed transfer sizes: unmeasured (documented).
- Manual a11y procedures: documented and applicable, but full assistive-technology pass (real screen reader on production) not executed — no production credentials needed for it, yet not performed this phase; flagged for the 13 checklist.

## Verification results

a11y + i18n suites green (final run 115 files / 1003 tests, exit 0); build 0; artifact gate clean.
