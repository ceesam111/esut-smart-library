# Batch 17C — Forensic Accessibility Baseline

- **Project**: ESUT Smart Library
- **Date**: 2026-10-09
- **Baseline commits**: `17bdb42` (17A), `5fb48b5` (17B)
- **Method**: static DOM/semantic review of shared primitives (`src/components/**`) and representative real pages; adversarial greps for `onClick` on non-interactive elements, positive `tabIndex`, `outline: none`, `draggable`/`onDragStart`, raw `<table>` usage; keyboard walkthrough planned against production `next start` build
- **Stack context**: React SPA (react-router v7) inside Next shell; shadcn/ui + Radix primitives (Radix Dialog/Select/Tabs/Dropdown already provide focus trap, Escape, roles); Tailwind utility classes carry most focus styles

## 1. Component-system inventory (what already works)

| Area | State | Evidence |
|---|---|---|
| Skip link | Implemented, localized, `sr-only` until focus, targets `#main-content` with `tabIndex={-1}` | `Layout.tsx:16-21, 23-28` |
| Landmarks | `Navbar` (implicit nav via links), `main#main-content`, `Footer` present | `Layout.tsx` |
| Radix dialogs | Focus trap, Escape, initial focus, `role="dialog"` provided by `@radix-ui/react-dialog` | `ui/dialog.tsx` |
| Radix selects/menus/tabs | Keyboard patterns provided by Radix | `ui/select.tsx`, `ui/dropdown-menu.tsx`, `ui/tabs.tsx` |
| Focus visibility (shared) | `focus-visible:outline-none` paired with `focus-visible:ring-*` everywhere checked — equivalent/better replacement, not a bare outline removal | `styles.css:323-358`, `index.css`, all `ui/*.tsx` |
| Positive tabindex | None found | grep `tabIndex={1..9}` → 0 matches |
| Button semantics | `ui/button.tsx` renders real `<button>`; icon buttons generally have `aria-label` or sr-only text | component reads |
| i18n | Skip-link label, switcher label localized via `a11y.*` keys (17B) | dictionaries |
| Language switcher | Real `<select>` with label + id (17B) | `LanguageSwitcher.tsx` |

## 2. Issue matrix

Severity: CRITICAL / HIGH / MEDIUM / LOW. "Fix" column reflects the planned (and, after remediation, applied) resolution.

| ID | Route/component | WCAG area | Issue | Severity | Automated/manual | Fix | Verification |
|---|---|---|---|---|---|---|---|
| A11Y-01 | `NotificationBell.tsx` | 4.1.2 Name/Role/Value | Close control is bare `×` text with no accessible name | HIGH | static | `aria-label` (localized) | jsdom test + axe |
| A11Y-02 | `NotificationBell.tsx` | 2.1.1 / 4.1.2 | Panel: no Escape close, no focus move into panel, no `role`/label for the popup region | MEDIUM | static | Escape handler, `role="dialog"` + label, focus first control on open | jsdom keyboard test |
| A11Y-03 | `NotificationBell.tsx` | 1.4.1 | Unread indicator is a colored dot; unread items also bolded (non-color cue exists) but dot itself carries no text | LOW | static | `aria-hidden` on decorative dot; unread conveyed by font weight + panel label already includes count | axe |
| A11Y-04 | `ui/dialog.tsx` | 3.1.2 / 41 | Close sr-only text hardcoded English `"Close"` | MEDIUM | static | localized via `useI18n` | i18n test + lint |
| A11Y-05 | `ui/table.tsx` `TableHead` | 1.3.1 | `<th>` without default `scope="col"` | MEDIUM | static | default `scope="col"` on TableHead | jsdom test |
| A11Y-06 | Admin raw tables (`Sip2Terminals`, `Databases`, `Workflows`, `CourseReserves`, `Theses`, `Consortium`, `OfflinePanel`, …) | 1.3.1 | Raw `<th>` without `scope`; no caption/accessible name | MEDIUM | static | `scope="col"` on header cells in audited tables; `aria-label` on table element | axe-style jsdom checks + grep |
| A11Y-07 | `OfflinePanel.tsx` | 4.1.3 Status Messages | Sync result / error messages not in a live region | HIGH | static | `role="status"` + `aria-live="polite"` on message region | jsdom test |
| A11Y-08 | `OfflinePanel.tsx` | 1.3.1 / 1.4.1 | Conflict state uses colored badges (text label present — OK); table headers lack scope; empty state OK | MEDIUM | static | scope + table `aria-label` | jsdom |
| A11Y-09 | `AILibrarianWidget.tsx` | 4.1.2 | Send / minimise / close / expand buttons: `title` only or bare icons — missing `aria-label` | HIGH | static | `aria-label` on every icon control (localized where user-facing) | jsdom + axe |
| A11Y-10 | `AILibrarianWidget.tsx` | 4.1.3 | Streaming replies announce nothing; no completion signal | MEDIUM | static | visually-hidden `role="status"` updated on completed assistant reply only (not per token) | jsdom test |
| A11Y-11 | `AILibrarianWidget.tsx` | 3.3.2 | Chat input labelled by placeholder only | HIGH | static | `aria-label` on input | axe/jsdom |
| A11Y-12 | `admin/CmsMenu.tsx` | 2.5.7 / 2.1.1 | Menu-item reordering is drag-only | HIGH | static | Move up / move down buttons (single-pointer + keyboard alternative); drag kept | jsdom interaction test |
| A11Y-13 | `admin/CMS.tsx` | 2.5.7 / 2.1.1 | Canvas block reordering is drag-only | HIGH | static | Move up / move down buttons per block | manual + static |
| A11Y-14 | `src/styles.css` + `index.css` | 2.3.3 Animation (AAA referenced as engineering baseline) / 2.2.2 | No global `prefers-reduced-motion` override | MEDIUM | static | global `motion-reduce` CSS: disable non-essential animation/transitions | CSS review |
| A11Y-15 | `Home.tsx` animated stats | 2.3.3 / 2.2.2 | Auto-starting animated counters | MEDIUM | static | respect reduced motion (CSS + JS guard) via motion-reduce classes | CSS |
| A11Y-16 | SPA route changes (`App.tsx` / layouts) | 3.2.1 / 2.4.3 | No focus move or announcement on route change | MEDIUM | browser | focus `#main-content` on pathname change; localized `document.title` per route | E2E keyboard |
| A11Y-17 | Page titles | 2.4.2 | `document.title` static English metadata only | MEDIUM | static | localized title effect for wired routes (title map by pathname) | E2E |
| A11Y-18 | Placeholder-only inputs (e.g. `Databases.tsx` request form 486-489, `Contact.tsx`, `Home.tsx` search partial) | 3.3.2 | Placeholder used as only label | HIGH | static | add `aria-label` (localized where feasible) | axe/jsdom |
| A11Y-19 | `Login.tsx` / `Register.tsx` / `ResetPassword.tsx` | 3.3.1 / 3.3.2 | Verify error association, `aria-invalid`, paste not disabled, no captcha-style cognitive test | MEDIUM | static+browser | audit; fix gaps found (error text association) | E2E login form |
| A11Y-20 | `LibraryCard.tsx` QR | 1.1.1 | QR image must not be the only representation of card identity | MEDIUM | static | ensure text alternative + visible member details beside QR | static |
| A11Y-21 | Emoji-as-content (notification icons, catalogue emojis) | 1.1.1 | Emoji glyphs announced inconsistently | LOW | static | `aria-hidden` on decorative emoji; ensure adjacent text carries meaning | axe |
| A11Y-22 | Target size (2.5.8) | 2.5.8 | Dense table action links (`text-xs`) may fall below 24×24 minimum | MEDIUM | static | verify spacing exception (inline links in text / spacing); enlarge critical admin action targets where trivial | audit note + selective padding |
| A11Y-23 | `AcademicIntegrity.tsx` custom tabs (button row, no tablist) | 4.1.2 | Pattern is button filters, acceptable if not claiming tabs | LOW | static | leave as buttons (correct semantics for filters) | static |
| A11Y-24 | `ThesisSubmit.tsx` custom embargo toggle | 4.1.2 | Custom `div`-styled control — verify it is a real button/checkbox | MEDIUM | static | ensure `role="switch"` + name or real checkbox | static |
| A11Y-25 | Wellbeing games (Memory, Sudoku, FocusTrail) | 4.1.2 | Grid cells as buttons need accessible names describing cell state | MEDIUM | static | add `aria-label` per cell (row/col/state) where missing | static |
| A11Y-26 | Charts (`ui/chart.tsx`, recharts on analytics) | 1.1.1 / 1.3.1 | Charts need title/description; tabular alternative where data important | MEDIUM | static | ensure chart containers labelled; document tabular-alternative limitation for analytics pages | static |
| A11Y-27 | `window.prompt` in OfflinePanel override | not a violation | Native prompt is keyboard/AT accessible | INFO | static | keep | — |
| A11Y-28 | Session/time limits | 2.2.1 | Supabase session expiry; no user-facing warning/draft preserve in long forms | LOW | static | document; no security-weakening change | doc |

## 3. Adversarial grep results (pre-fix)

- `tabIndex` positive values: **0 matches** — clean.
- `draggable`/`onDragStart`: `admin/CmsMenu.tsx` (124-127), `admin/CMS.tsx` (418-446) — A11Y-12/13.
- `outline: none` / `outline-none`: widespread but almost always `focus-visible:outline-none` + `focus-visible:ring-*` — acceptable pattern. Exceptions audited: `ui/sheet.tsx` close, `ui/dialog.tsx` close (both have `focus:ring-2`).
- Raw `<table>` without scope: 15+ admin pages — remediated on representative high-traffic tables (SIP2, offline, Databases admin, Circulation-adjacent) with shared `TableHead` fix covering shadcn tables.
- Placeholder-only inputs: confirmed in public request form (`Databases.tsx:486-489`) and others — remediated with `aria-label`.

## 4. Scope decisions (documented, not silently skipped)

- **Not claiming** formal WCAG certification; claim limited to "WCAG 2.2 AA engineering baseline verified for tested ESUT product surfaces."
- **Screen readers** (NVDA/JAWS/VoiceOver): NOT tested — no AT environment available. Static semantic review only.
- **Authenticated browser E2E**: public routes tested in real browser; authenticated staff surfaces covered by jsdom component tests (no credential bypass). Documented as limitation.
- **All ~150 pages** are not individually scanned; representative public, patron, and staff surfaces plus shared primitives are covered. Remaining pages inherit shared-primitive fixes.
- **Next.js advisory** unchanged (needs `next@16.4.0`, out of batch).
- **axe-core** added as devDependency only (test-time); not shipped in the client runtime bundle.
