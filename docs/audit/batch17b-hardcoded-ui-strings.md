# Batch 17B — Hardcoded UI Strings Regression Scan

- **Project**: ESUT Smart Library
- **Date**: 2026-10-09
- **Scope**: the 17 Batch-17B target pages (7 public, 3 auth, 5 patron, 5 admin — Login counted in auth chrome work) plus shared chrome, after full i18n wiring
- **Method**: full string inventory (explore pass) before wiring; after wiring, programmatic scan of every `src/app-pages/**/*.tsx` file counting `t(` call sites and grepping for residual literal patterns (`Due: `, `}by {`, `alt="Profile"`, `console.(error|warn|log)`, `<BackButton`)

## 1. Coverage after wiring

`t()` call sites inside `src/app-pages/` (target pages only; every other page is still at 0 by design):

| Group | File | `t()` calls |
|---|---|---:|
| Public | `Home.tsx` | 48 |
| Public | `Catalogue.tsx` | 59 |
| Public | `CatalogueItem.tsx` | 104 |
| Public | `GlobalSearch.tsx` | 64 |
| Public | `Repository.tsx` | 42 |
| Public | `RepositoryItem.tsx` | 80 |
| Public | `Events.tsx` | 32 |
| Auth | `Login.tsx` | 19 |
| Auth | `Register.tsx` | 10 |
| Auth | `ForgotPassword.tsx` | 11 |
| Auth | `ResetPassword.tsx` | 14 |
| Patron | `dashboard/Dashboard.tsx` | 29 |
| Patron | `dashboard/Loans.tsx` | 34 |
| Patron | `dashboard/MyProfile.tsx` | 56 |
| Patron | `dashboard/Settings.tsx` | 68 |
| Patron | `dashboard/LibraryCard.tsx` | 31 |
| Admin | `admin/Admin.tsx` | 38 |
| Admin | `admin/Catalogue.tsx` | 104 |
| Admin | `admin/Circulation.tsx` | 89 |
| Admin | `admin/Notices.tsx` | 53 |
| Admin | `admin/Patrons.tsx` | 75 |
| **Total** | | **1078** |

Shared chrome (`Layout`, `Navbar`, `Footer`, `DashboardLayout`, `AdminLayout`, `LanguageSwitcher`) fully wired in the same pass.

## 2. Final gap fixes applied in this batch

| Location | Literal | Fix |
|---|---|---|
| `CatalogueItem.tsx`, `GlobalSearch.tsx`, `RepositoryItem.tsx`, `dashboard/{Loans,LibraryCard,Settings,MyProfile}.tsx` | bare `<BackButton />` → default English `label='Back'` | `<BackButton label={t('common.back')} />` (7 files) |
| `dashboard/Dashboard.tsx:260` | `Due: {formatDate(...)}` | `{t('dashboard.dueOn', { date: formatDate(...) })}` — new key, en `Due: {date}` / fr `Échéance : {date}` |
| `dashboard/Loans.tsx:218` | `by {authors}` | `{t('loans.byAuthor', { authors })}` — new key, en `by {authors}` / fr `par {authors}` |
| `dashboard/MyProfile.tsx:246` | `alt="Profile"` | `alt={t('profile.profilePhoto')}` (existing key) |

After these fixes, a repeat grep of the 17 target pages finds **zero** remaining user-visible hardcoded English literals outside the categories below.

## 3. Remaining literals — intentional, documented, not defects

| Category | Examples | Justification |
|---|---|---|
| Proper names | `ESUT`, `ESUT SMART LIBRARY`, logo `alt="ESUT Logo"` | Brand/institution names are not translated |
| Database / source / provider names | Crossref, PubMed, Project Gutenberg, JSTOR, Google Scholar | Proper nouns; translating them would break trust and recognition |
| Identifiers | ISBN, ISSN, DOI, ORCID values and their row labels used as raw field ids (`id: 'DOI'`) | Identifiers are locale-neutral data |
| Emails / phones / URLs | `you@university.edu.ng`, support addresses, phone numbers | Data, not chrome; example placeholder deliberately kept |
| Data-derived status values | `capitalize(item.status)` fallbacks for database status columns | Values come from data; dictionary maps only the known enums (e.g. `events.status*`), unknown values fall back to capitalized data |
| Rule / config field names | circulation rule identifiers shown to admins | Technical identifiers, not prose |
| Console diagnostics | `console.error('Error fetching loans:', error)` (~10 in target pages) | Developer-only output, never rendered in the UI; translating logs would hurt debuggability |

## 4. Out-of-scope leftovers (not Batch 17B targets)

- `BackButton.tsx` keeps its English default `'Back'`; pages outside the 17-target set still call it bare or with `label="Back"` (`dashboard/ILLHistory.tsx`, `dashboard/LecturerProfile.tsx`, `dashboard/DashboardCourseReserves.tsx`, `dashboard/ReadingLists.tsx`, plus various non-target public/admin pages). Passing `label={t('common.back')}` there belongs to a later wave.
- All non-target pages (`About`, `FAQ`, `Contact`, most admin sub-pages, etc.) remain at 0 `t()` calls — untranslated by design until their own batch.
- A few dictionary keys are currently unreferenced (e.g. candidates flagged during wiring such as `nav.esutLibrary`, `catalogue.pageOf`). No keys were removed — removal is a cleanup task, not behavior-preserving wiring.

## 5. Verification commands

```
node node_modules\eslint\bin\eslint.js <all touched files> --max-warnings=0   → 0 problems
node node_modules\typescript\bin\tsc --noEmit --incremental false            → 0 errors
node node_modules\vitest\vitest.mjs run src/lib/i18n.test.ts                 → 15/15
node node_modules\vitest\vitest.mjs run src/lib/i18n.component.test.tsx      → 7/7 (jsdom)
```
