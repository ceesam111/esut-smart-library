# PART XLIV — SLAAS Gap Audit and Build/Defer Decisions

Date: 2026-10-10. Scope: platform capability gaps identified during final-run
inventory review, with an explicit build/defer decision for each (verification
before building — no duplicate functionality was created).

## Built this run (cheap, high-value, gate-relevant)

| Gap | Decision | Evidence |
|---|---|---|
| Secrets scanning | **BUILT** — `scripts/scan-secrets.mjs` (12 pattern rules + secret-named `.env.local` value-leak check over all tracked files) | `npm run scan:secrets` → 0 findings / 1002 files |
| SAST | **BUILT** — `eslint-plugin-security` rules in `eslint.config.mjs` (eval, child-process, unsafe-regex, buffer, bidi/invisible chars) + `scripts/sast-scan.mjs` (8 project rules incl. disable-ratchet, shell-injection, TLS bypass, weak hash) | `npm run scan:sast` → 0 findings; 4 shell-template `execSync` call sites converted to `execFileSync` |
| Test coverage instrumentation | **BUILT** — `@vitest/coverage-v8` + `npm run test:coverage` | 766/766 pass; 51.38% lines / 42.22% branches |

The `eslint-disable` sites are ratchet-baselined in `scripts/.sast-baseline.json`
(10 pre-existing occurrences recorded by file+rule); any new occurrence fails the scan.

## Deferred with rationale (per PART XLIX do-not-overbuild)

| Gap | State | Rationale |
|---|---|---|
| OpenAPI document | DEFERRED | Route handlers are already Zod-validated; no external API consumer exists to serve a spec to. Generating a spec becomes worthwhile only when third-party integrations appear. |
| API versioning | DEFERRED | Single-institution deployment with no external API clients; all consumers ship with the platform (breaking changes ride the normal release). |
| Domain events (bus) | PARTIAL, deferred | `analytics_events`, `audit_logs`, notice delivery and offline-sync ledger already provide the observable event trail; a publish/subscribe bus has no second consumer. |
| AI RAG (vector retrieval) | DEFERRED | No pgvector/embeddings infrastructure and no product requirement; the AI reference librarian works from the curated tools directory. |
| AI safe tool-use framework | PARTIAL, deferred | AI features are read-only over curated data with privacy-aware cloud fallback; an agentic tool-execution sandbox is unnecessary until tools are actually executed. |
| ERM (licensing/entitlements) | DEFERRED | Serials/kbart coverage addresses current needs; no entitlement data source exists. |
| POS / payments | NOT APPLICABLE | No paid service in product scope; would require payment connectors (test-mode approval flow) without a customer. |
| Storage abstraction layer | DEFERRED | One storage backend (application filesystem + hosted database); an abstraction adds indirection with no second implementation planned. |
| Malware scanning (uploads) | DEFERRED | Requires infrastructure-level scanning (e.g. ClamAV service) not available in this deployment; noted as an operational control for the institution to provide. |

## Re-verified this run

Gap items that were previously PARTIAL were re-checked rather than rebuilt:
webhook egress remains COAR-Notify-only (documented), retention remains
configurable-by-policy but not automated (documented in
`docs/privacy/slaas-dpia-technical-input.md` §6 and as an operational gap).

## Non-duplication check

Nothing in this audit created functionality that already existed elsewhere in
the platform: scanners are dev-tooling only (no runtime dependency), coverage is
test-instrumentation only, and no new runtime client library was introduced.
