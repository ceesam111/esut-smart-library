# 04 — Remaining Feature Gaps (Phase 22, §4 consolidated)

Status legend: ✅ complete this phase · ⚠️ partial with evidence · 🚫 BLOCKED (named dependency) · 📌 standing (owner-gated, pre-existing)

## Completed this phase

| ID | Area | What closed |
|---|---|---|
| T09 | Journal/OER integration | Global Search dual-source wiring (repository + catalogue) via `localSearch.ts`, crossref/semanticScholar/archive/ajol source inclusion, 6 new tests |
| CSRF | Security (production-only defect) | Middleware `csrf-token` issuance + client `csrfFetch` echo; 15 new tests |
| Admin/submit auth | Workflow integrity | 8 pages / 23 call sites now send session `Authorization`; routes remain Bearer-gated |
| Live localhost defect | Config | `appBaseUrl()` = `APP_BASE_URL` else canonical fallback; all local builds re-verify with corrected env; inline artifact gate shows `localhost:3000` = 0 across 2,228 output files |

## Feature gaps — detailed status by track

### T03 — Submission & moderation 🚫 BLOCKED
- Code-path: 12/12 steps verified at test level (see 02).
- Live E2E with real roles: **BLOCKED** — no production/staging accounts; account creation = production DB modification (owner approval).
- Production application of RLS migration `20261011130000`: **BLOCKED** — owner approval (see 03).

### T04 — Researcher identity & ORCID ⚠️→✅ implementation / 📌 OAuth
- Identity infrastructure implemented earlier in-phase: `src/server/identity/`, `src/lib/identity/`, `src/server/identity/*` tests, `app/api/admin/identity/`, `app/api/profile/`, migration `20261022100000_identity_hardening.sql` + rollback, ORCID format validation used by `RepositorySubmit` (`validateOrcidId`).
- ORCID **OAuth linking**: standing item — requires an ORCID application registration (institutional decision + credentials). Not implemented; fabricating verification was explicitly forbidden and not done. See 05.

### T08 — Research visibility analytics ✅ implementation / ⚠️ external confirmation
- `src/server/analytics/visibility.ts` + tests, `app/api/admin/analytics/research/` routes, `route.test.ts` coverage.
- Google Search Console confirmation: **no placeholder invented** — GSC verification remains an institutional-access item (📌). Internal metrics are reported separately from external indexing claims. See 06.

### T09 — Journal & OER ✅ / ⚠️ known gap
- Implemented + tested (see 07). Known gap: **theses are excluded from Global Search** because `theses` has no `search_vector` — documented rather than silently faked.
- `aiSummary` on search results: intentionally left as a guarded-off empty field (never fabricate).

### T10 — Digital preservation ⚠️ / 🚫 restore drill
- Checksum/fixity/retention/backups monitoring: `src/server/preservation/backups.ts` + `retention.ts` + tests, migration `20261022090000` + rollback, `app/api/preservation/export/`, `worker/preservation/`.
- **Documented restoration exercise: BLOCKED** — no authorized non-production environment with the real backup artifact was available; exact procedure documented instead (see 08), per §7's explicit allowance.

### T11 — Responsible AI discovery ✅ boundaries / 📌 paid providers
- Grounding/token-budget/permission-aware retrieval implemented and tested (see 09). No paid model provider connected (forbidden without approval); graceful-degradation + evaluation tests in place.

### T12 — Accessibility & performance ⚠️
- Automated a11y suites green (`a11y.test.tsx`, `i18n.component.test.tsx`); manual procedures documented; bundle measured before/after (see 10).
- **Core Web Vitals field data: 📌 unavailable** — requires deployed-site GSC/CrUX access; lab measurements only, no improvement claimed without comparative field data.

## Cross-cutting standing items (unchanged, owner-gated) — for 13/16 checklist

- Production env vars: `OAI_ENABLED`, `OAI_TOKEN_SECRET`, `APP_BASE_URL`.
- GitHub PAT rotation; Resend DNS; Cloudflare Turnstile keys.
- Deposit & copyright policy approval; restore drill (T10); GSC sitemap submission + verification.
- ORCID OAuth registration; embeddings/pgvector for semantic search (paid/infra decision).
- Coolify image build + flip for Phase 22 (explicit approval required).
- `researcher_profiles.institution` column `DEFAULT 'Adeyemi Federal University of Education'` in migration `20260620202944…` (line 599) — wrong-institution default on an ESUT table (institution is `Enugu State University of Science and Technology` per `institution.config.ts`). **Confirmed defect source-audit finding, not yet pursued as a migration** — fixing it requires a new migration; per the phase constraint no migration is added unless pursued, and applying anything to production is owner-gated. Recorded here as a documented open defect with the exact file/line.
- Misc pre-existing findings from prior re-audit, unchanged: `versions_read` US(true); supervisor direct theses UPDATE blocked; `Settings.tsx` `degree_programme` mismatch; anon view counters ineffective under RLS; middleware→proxy deprecation notice; `publicPdfUrl` rejects `http`.
- Arcjet returns 403 to curl/automated clients on `/api/repository*` — real-user (browser) impact **undetermined**, documented rather than assumed either way.

## Verification result for this deliverable

Full suite after all Phase 22 changes: **115 files / 1003 tests passed, exit 0**. `tsc --noEmit` exit 0. ESLint exit 0 (changed files + new tests). `next build` exit 0 with corrected `NEXT_PUBLIC_*` env.
