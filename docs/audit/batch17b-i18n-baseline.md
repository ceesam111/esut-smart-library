# Batch 17B — i18n Baseline Audit

- **Project**: ESUT Smart Library (ESUT Library Platform)
- **Date**: 2026-10-07
- **Baseline commit**: `17bdb42` (Batch 17A closure)
- **Scope**: application-wide internationalization (interface localization)

## 0. Architecture context (decides the integration pattern)

The product is a **client-side SPA** hosted inside a Next.js 16 App Router shell:

- `app/layout.tsx` — static root layout, hardcoded `<html lang="en">`, static English
  metadata. Server-rendered shell only.
- `app/page.tsx` + `app/[...slug]/page.tsx` — both render `ClientAppWrapper`
  (`next/dynamic`, `ssr: false`) → `src/ClientApp` → `src/App.tsx`.
- `src/App.tsx` — **react-router-dom v7** `BrowserRouter` with ~150 lazy-loaded pages
  from `src/app-pages/` and three chrome layouts (`Layout`, `DashboardLayout`,
  `AdminLayout`).
- `middleware.ts` — security only (CORS, CSRF, rate limiting, Arcjet). No locale logic.

Consequences for i18n design:

1. There is **no Next.js server-side page rendering** to localize; all UI strings are
   rendered client-side. Route-based locale prefixes (next-intl style) would add a
   second, conflicting routing system on top of react-router — rejected.
2. The correct pattern is a **client-side preference-based locale** (cookie +
   localStorage) with a React context provider, exactly matching the existing SPA
   architecture. Locale survives navigation and refresh by persistence, not by URL.
3. `<html lang>` is set client-side from the resolved locale (React does not own
   `<html>`, so no hydration mismatch is possible; the server shell always renders
   `lang="en"` and the provider corrects it on mount).

## 1. Area-by-area audit

| Area | Current state | Evidence | Defect | Planned resolution |
|---|---|---|---|---|
| i18n library/framework | None (no next-intl / i18next / react-intl). Hand-rolled module | `package.json` deps; `src/lib/i18n.ts` | No framework features (interpolation, plurals, typing) | Evolve the existing module (no replacement — see §2) |
| Locale files | Inline in `src/lib/i18n.ts`: `translations: Record<Locale, Record<string, string>>` | `src/lib/i18n.ts:3` | Strings colocated with logic; flat dotted keys | Split into `src/lib/i18n/dictionaries/{en,fr}.ts`, nested namespaces |
| Translation file structure | Flat dotted keys (`nav.home`, `common.save`), ~130 keys/locale | `src/lib/i18n.ts:4-268` | Flat structure; no namespaces; no type safety | Nested per-area namespaces + `TranslationKey` union type |
| Locale provider | None | grep: only `i18n.test.ts` imports the module | No React integration; zero page callers | New `I18nProvider` + `useI18n()` context |
| Middleware | `middleware.ts` — CORS/CSRF/rate-limit/Arcjet only | `middleware.ts:115-152` | No locale cookie handling needed (client-resolved) | None required; cookie is client-set, allowlist-validated |
| Route handling | react-router v7 SPA; `app/[...slug]` catch-all | `src/App.tsx:167-323` | n/a — preference-based locale needs no route changes | None |
| Server-side translation | None (all UI client-rendered) | `app/layout.tsx` static | n/a | Client provider only |
| Client-side translation | Pure function `t(locale, key)` with en→key fallback | `src/lib/i18n.ts:270-271` | No interpolation, no plurals, no typing, no callers | Extend in place (same signature + optional vars) |
| Locale persistence | None | — | Selection lost on refresh | Cookie `esut_locale` + localStorage mirror |
| Default locale | Implicit `en` (hardcoded `lang="en"`, English UI) | `app/layout.tsx:27` | Not explicit/configurable | `DEFAULT_LOCALE = 'en'` constant |
| Fallback locale | `t()` falls back to `en`, then raw key | `src/lib/i18n.ts:271` | Silent raw-key rendering | `FALLBACK_LOCALE = 'en'` + dev warning on missing key |
| Language selector | None | no component exists | — | New accessible `LanguageSwitcher` in all 3 layouts |
| Static vs dynamic import | Static (single module, both locales) | `src/lib/i18n.ts` | Both locales always shipped | Acceptable: ~130 keys × 2 locales ≈ 30 KB; no dynamic loading needed (see §22) |
| Page metadata localization | Static English metadata | `app/layout.tsx:4-19` | Title/description never localized | Localize via client effect (`document.title`) for wired pages; document limitation |
| Validation messages | Hardcoded English in forms | `src/app-pages/Login.tsx`, `Register.tsx`, `ResetPassword.tsx` | Not localizable | `validation.*` keys + form wiring |
| Accessibility labels | Hardcoded English `aria-label`s | `Layout.tsx:18,37,40`, `Navbar.tsx` many | Not localizable | `a11y.*` keys |
| Date/time formatting | Manual `toLocaleDateString('en-GB'/'en-NG')` hardcoded; `new Date(...).toLocaleString('en-GB')` in emails | `src/app-pages/admin/Admin.tsx:188`, `src/server/email.ts:162,188,348…` | Locale hardcoded, not user-aware | `formatDate`/`formatDateTime` via `Intl.DateTimeFormat(locale, …)` |
| Number formatting | Raw numbers; `₦` symbol hardcoded in worker emails | `worker/handlers/communications.ts:160,177` (`₦${…}`) | Not locale-aware | `formatNumber`/`formatCurrency` via `Intl.NumberFormat` |
| Currency | `₦` hardcoded; no currency config | `worker/handlers/communications.ts:160`; `src/config/institution.config.ts` has no currency key | Hardcoded symbol | `Intl.NumberFormat(locale, { style: 'currency', currency: 'NGN' })` |
| API error shape | Stable codes + public message already exist | `src/server/api/errors.ts` — `ApiErrorCode`, `publicErrorMessage()` | Messages English-only | Frontend `errors.*` map keyed by stable code; no backend change |
| Email/notice templates | `src/server/email.ts` — all dates `'en-GB'`, no locale param; `templateRepository.ts` selects by notice type with builtin fallback, no locale dimension | `src/server/email.ts` (14+ hardcoded `'en-GB'`), `src/server/circulation/templateRepository.ts` | No locale-aware rendering; recipient locale unavailable (no `patrons.locale` column) | Document as limitation; locale param optional with `en` fallback where caller knows locale |
| CMS content | `cms_pages.blocks` JSON, single language | `src/app-pages/admin/CMS.tsx` | No multilingual content support | Out of scope — UI localized, authored content preserved (mission §17) |
| Search/catalogue | Bibliographic metadata is data, not UI | `src/app-pages/Catalogue.tsx` | UI labels hardcoded | Translate filters/labels/empty states/pagination; never touch metadata |
| Dead i18n code | None (module is small and clean) | — | — | Consolidate into the new structure; no competing system |

## 2. Stack decision

**Keep and evolve `src/lib/i18n.ts`.** Reasons:

- It is already the single source of truth for UI strings (en + fr dictionaries).
- The app is a client SPA; a URL-based library (next-intl) would conflict with
  react-router and add server complexity with zero benefit.
- No new dependency is required: React context + `Intl` API cover provider,
  interpolation, plurals (`Intl.PluralRules`), dates, numbers and currency.
  (Adding a dependency would also require a `package.json` change.)

## 3. Supported locales

| Locale | Role | Evidence |
|---|---|---|
| `en` | **Default + fallback** | All UI authored in English; `lang="en"` shell |
| `fr` | **Alternate (end-to-end verified)** | Complete translation resource exists in `src/lib/i18n.ts` (fr dictionary, ~130 keys) |

No other locale has translation resources; per mission §2, only `fr` is enabled for
end-to-end verification. The allowlist (`LOCALES = ['en', 'fr']`) makes adding a
locale a data change, not a code change.

**Interface localization ≠ bibliographic metadata language.** Catalogue records,
repository items, theses, MARC data and CMS-authored content remain in their
original language. Only application chrome and interaction text are localized.

## 4. Locale resolution precedence (deterministic, single source of truth)

1. `esut_locale` cookie (explicit user selection — survives refresh/login/logout)
2. `localStorage['esut_locale']` (mirror for non-cookie contexts)
3. Browser preference (`navigator.language` primary subtag, allowlist-matched)
4. `DEFAULT_LOCALE` (`en`)

The cookie is the single persisted source of truth; localStorage is a mirror written
at the same time. There is no per-user DB column (no migration in this batch), so
preference is **not** reset by login/logout — consistent server/client selection is
guaranteed because both read the same cookie. Invalid cookie values are rejected by
the allowlist and fall through to the next source (security §25).

## 5. Missing-key behavior

- Runtime: `translations[locale][key]` → `translations[fallback][key]` → raw key
  (never `undefined`, never an object, never a crash).
- Development: `console.warn` on missing key (visible in dev tools and CI logs).
- Compile time: `TranslationKey` union type makes unknown keys a type error.

## 6. Verification commands

- Unit: `npx vitest run src/lib/i18n.test.ts src/lib/i18n/I18nProvider.test.tsx`
- Component: jsdom environment via per-file `@vitest-environment jsdom` pragma
- E2E: `node_modules\.bin\tsx.cmd scripts\e2e-i18n-live.ts` (Playwright + system
  Chrome via `channel: 'chrome'`, against a running dev/production server)
- Gates: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
