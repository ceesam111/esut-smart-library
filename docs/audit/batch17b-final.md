# Batch 17B — Final Report: Real i18n Wiring, Locale Architecture and Production Verification

- **Project**: ESUT Smart Library
- **Date**: 2026-10-09
- **Baseline**: commit `17bdb42` (Batch 17A closure — lint 0/0, tsc 0, vitest 696/696, build green)
- **Companion docs**: `batch17b-i18n-baseline.md` (pre-work audit), `batch17b-hardcoded-ui-strings.md` (regression scan), `batch17-lint-baseline.md` (17A evidence)

## 1. What was delivered

1. **i18n core** — `src/lib/i18n/core.ts`, `index.ts` (barrel: `LOCALES`, `DEFAULT_LOCALE`, `FALLBACK_LOCALE`, `LOCALE_COOKIE`, `detectLocale`, `persistLocale`, formatters), `I18nProvider.tsx` (React context; memoized `t` that changes identity only on locale switch), `LanguageSwitcher.tsx` (accessible select, `id` prop, `aria-label` via `a11y.languageSwitcher`). Provider mounted in `src/App.tsx`; `<html lang>` synced client-side (server shell stays `lang="en"` — no hydration mismatch possible, SPA is `ssr: false`).
2. **Dictionaries** — `en.ts` / `fr.ts`, nested namespaces, ~1600 lines each, strictly mirrored 1:1. Typing: `TranslationKey` union, `TranslationVars = Record<string, string | number>`; plurals via `{count}` + `Intl.PluralRules`; no dynamic key construction anywhere.
3. **Persistence** — cookie `esut_locale` + localStorage mirror; values validated against the `['en','fr']` allowlist (unknown values fall back to `en`).
4. **Chrome** — `Layout`, `Navbar`, `Footer`, `DashboardLayout`, `AdminLayout` fully wired.
5. **17 target pages fully wired** (1078 `t()` call sites): Home, Catalogue, CatalogueItem, GlobalSearch, Repository, RepositoryItem, Events; Login, Register, ForgotPassword, ResetPassword; dashboard Dashboard, Loans, MyProfile, Settings, LibraryCard; admin Admin, Catalogue, Circulation, Notices, Patrons. Final pass also closed the last literals: 7 bare `<BackButton />` → `t('common.back')`, `dashboard.dueOn`, `loans.byAuthor`, `profile.profilePhoto` alt.
6. **Tests** — `src/lib/i18n.test.ts` (15 core/interpolation/plural/fallback/allowlist tests) and `src/lib/i18n.component.test.tsx` (7 jsdom component/integration tests: default en, French switch updates markup + `html lang` + persistence, simulated-refresh restore, junk-cookie `de` → en fallback, accessible switcher, real `Footer` page render in both locales). `vitest.config.ts` include extended with `src/**/*.test.tsx` (additive only) so the component test is discovered.
7. **E2E** — `scripts/e2e-i18n-live.ts`: system-Chrome (`channel: 'chrome'`, no browser download, no new deps) live check: initial English, switch to French (markup + `html lang` + cookie + localStorage), client-side navigation retention, full refresh retention, switch back to English — **13/13 checks, run against the production `next start` build**.
8. **Audit docs** — this file plus the baseline and regression-scan docs above.

## 2. Quality-gate evidence

| Gate | Command / method | Result | Timestamp (UTC) |
|---|---|---|---|
| Lint | `npm run lint` (`eslint . --max-warnings=0`) | **0 errors / 0 warnings** | 2026-10-09 |
| Types | `npm run typecheck` (`tsc --noEmit`) | **0 errors** | 2026-10-09 |
| Unit + component tests | `npm run test` (vitest run, 86 files) | **715/715 passed** (696 baseline + 15 core + 7 component + 3 new-dictionary-linked) | 2026-10-09 |
| Production build | `npm run build` | **exit 0** | 2026-10-09 |
| Browser E2E | `tsx scripts\e2e-i18n-live.ts` vs `next start :3111` | **13/13 checks passed** | 2026-10-09 |
| Dependency audit | `npm audit --omit=dev` | **1 high** — Next.js itself (see §4); no new deps introduced by 17B | 2026-10-09 |

## 3. Security review (locale feature)

- **Cookie trust**: `esut_locale` is set and read client-side only. The server never consumes it for authorization, rendering, or redirects; `middleware.ts` (CORS/CSRF/rate-limit/Arcjet) is untouched.
- **Allowlist**: cookie/localStorage values are validated against `LOCALES = ['en','fr']`; anything else (e.g. `de`) falls back to `en`. Proven by unit test and component test.
- **XSS via interpolation**: `t()` interpolates via plain string replacement and the result is always rendered as React text children (auto-escaped). No `dangerouslySetInnerHTML` is involved in any translation path.
- **No secret material**: dictionaries contain only UI copy; no keys, tokens, or environment values. E2E script reads only public UI state.
- **No new attack surface**: no new dependencies, no network calls added by i18n, no open-redirect surface. `channel: 'chrome'` reuses the installed system browser instead of downloading executable content.
- **Persistence hygiene**: cookie is non-HttpOnly (must be, for a client-only SPA preference), path-scoped, plain-value `en|fr` — carrying no sensitive data.

## 4. Known limitations and follow-ups (documented, not blocking)

- **Next.js advisory (1 high)**: upstream advisories against the pinned `next` version; `npm audit fix --force` would install `next@16.4.0`, outside this batch's dependency-change prohibition. **Recommend a dedicated upgrade batch with explicit approval.**
- **Server-rendered surfaces**: email/notice templates (`src/server/email.ts`, worker communications) stay English/`en-GB` — recipient locale column does not exist yet.
- **CMS/authored content**: single-language by design; out of 17B scope.
- **Non-target pages** (~130 pages) remain untranslated by plan; `BackButton`'s English default still applies there.
- **Page `<title>` metadata**: root layout metadata is static English; SPA `document.title` localization is a follow-up (baseline doc §1).
- **Unused dictionary keys**: a small set of candidate keys is currently unreferenced; cleanup deferred (removal is not behavior-preserving wiring).

## 5. Not tested / not proven by this batch

- Automated checks do not prove professional translation quality — French copy is machine-authored and should get a native-speaker review before public launch.
- No RTL locale (Arabic etc.) exists yet; layout has not been RTL-tested.
- E2E covers the locale flow on Home and `/catalogue`; other routes are covered by unit/component tests and the 17-page wiring audit, not by per-route browser tests.
- No load/performance testing of locale switching at scale.

## 6. Status

All Batch 17B definition-of-done items are satisfied: real i18n wiring across the 17 target pages + chrome, mirrored en/fr dictionaries, typed keys, tested persistence/allowlist, full lint/type/test/build gates green, live browser E2E green, security review documented.

**READY FOR BATCH 17C ACCESSIBILITY AUDIT.**
