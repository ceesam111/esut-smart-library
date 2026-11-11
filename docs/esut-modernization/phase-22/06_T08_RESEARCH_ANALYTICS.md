# 06 — T08: Research Visibility Analytics (Phase 22, §5)

## Implemented (this phase, earlier sessions)

| Component | Location |
|---|---|
| Visibility metrics engine | `src/server/analytics/visibility.ts` + `visibility.test.ts` |
| Research analytics API | `app/api/admin/analytics/` and `app/api/admin/analytics/research/` (incl. `route.test.ts`) |

## Coverage of §5's required reporting

| Requirement | Status / evidence |
|---|---|
| Approved publications | ✅ analytics queries over published states (visibility module) |
| Publications by faculty / department | ✅ grouped queries in visibility module |
| Theses and dissertations | ✅ thesis scope included |
| Deposits over time | ✅ time-bucketed series |
| Public full-text records | ✅ public-file flag in visibility metrics |
| Downloads / Views | ⚠️ counters exist; **known pre-existing limitation**: anonymous view counters are ineffective under RLS (anon cannot UPDATE counters — prior re-audit finding). Documented, not papered over. |
| Referrer classifications | ✅ referrer classification present (§10 brief item also covered by probe review) |
| Metadata completeness | ✅ completeness ratio metric |
| Broken links / duplicate records | ✅ URL-report (`app/api/url-report/`, probe live: 200) and duplicate detection surfaces |
| Search visibility diagnostics | ✅ search diagnostics endpoint (anon probe `search-anon` returned `localResults:[]` + external candidates against the test project — correct behavior for the sparse test data) |

## Genuine events, no bot inflation (§5 mandate)

- Analytics read from server-side records and the visibility module's classification logic; client `trackClientEvent`/`/api/events/track` is a signal, not the source of truth for reported figures.
- The CSRF fix restores event POSTs that were being 403'd on production — without it, event-based metrics would have silently under-reported on production only (a reporting-accuracy defect in itself).
- Bot/automation traffic is not counted as human activity: the Arcjet layer blocks automated clients (observed: 403 to curl on repository APIs), and visibility classification separates automated signatures from readers.

## Internal vs external separation (§5 mandate)

Internal visibility metrics are labeled as such; **no Google-indexing claim is made anywhere** — GSC confirmation remains an institutional-access item (no placeholder created, per the brief's explicit prohibition). This matches the standing rule: never claim Google indexing without independent verification.

## Personal information protection (§5 mandate)

Admin analytics endpoints are `requireRole`-gated (verified on the routes this session); reports expose aggregate counts, not patron PII. The Reports admin page now authenticates correctly (fix this session) instead of failing 401 — see 02/11.

## Date filters, pagination, exports (§5)

Date-bucketed series + filters are implemented in the analytics routes; pagination applies to record listings; exports (BibTeX/RIS/CSV-style report outputs) verified in the regression batch (`citationExport` suite green; Reports `action:'export'` path exercised by tests).

## Resolved problems

- Reports/admin analytics pages were calling protected routes without credentials (401) — fixed (8 files, 23 call sites; reports/notice/analytics family included).
- Event under-reporting on production caused by CSRF 403s — fixed.

## Remaining issues / unverified

- Real-event accuracy against **production** DB records: unverified (read-only probes only; no admin session exists live).
- Anonymous view-count metric remains unreliable under RLS until the counter design is revisited (pre-existing, documented).
- GSC-confirmed indexing: BLOCKED on institutional GSC access.

## Verification results

Visibility + analytics tests green inside the final full run (115 files / 1003 tests, exit 0); `tsc` 0; ESLint 0; build 0.
