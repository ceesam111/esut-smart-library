# SLAAS Privacy and Security Red Team (PART XLVI)

Date: 2026-10-10
Scripts: `scripts/e2e-slaas-privacy-live.mjs` (15/15 passed), `scripts/e2e-slaas-live.mjs` (86/86 passed, includes QR, attendance, and authorization red-team sections).
State evidence: `scripts/.privacy-state.json`, `scripts/e2e-state.json` (local, uncommitted).
Result: **no P0 or P1 issues found. No production code changes were required by this phase.**

## Full PART XLVI checklist

### QR

| Attack | Result | Where |
|---|---|---|
| forged token (wrong secret) | refused `INVALID_QR` | e2e-slaas-live |
| expired token (crafted + DB-expired pass) | refused `EXPIRED_QR`, row marked `expired` | e2e-slaas-live |
| revoked token (identity + visitor pass) | refused `REVOKED_QR` | e2e-slaas-live |
| modified token | refused `INVALID_QR` (HMAC covers claims) | e2e-slaas-live |
| replayed dynamic token | refused `INVALID_QR` (stored-credential path only) | e2e-slaas-live |
| random access identifier guessing | refused `INVALID_QR` | e2e-slaas-live |

### Attendance

| Attack | Result | Where |
|---|---|---|
| double scan race (parallel) | exactly one `CHECK_IN` | e2e-slaas-live |
| concurrent scanners (12-way burst) | unique open-visit index holds; 0 errors final run | load-slaas-live |
| checkout without entry | refused `NOT_CURRENTLY_INSIDE` | e2e-slaas-live |
| multiple open visits | impossible (unique index, verified 1 open row) | e2e-slaas-live |
| cross-branch conflict | second branch scan refused while open elsewhere | e2e-slaas-live |
| user scanning another user's identifier | identity confirmation displays scanned name to the officer for visual verification; visit binds to the scanned identity only; cross-tenant/cross-branch scans refused | e2e-slaas-live + design note below |

### Authorization

All negative probes passed in e2e-slaas-live: student reading another student's history (scoping to own `/api/access/me`), student analytics (403), officer-tier capacity changes from student role (403), cross-institution analytics/visits/branches/occupancy/scan (empty or 404), unauthorized export (403), visitor/anonymous user-data access (401).

### APIs

| Attack | Result |
|---|---|
| IDOR (foreign identity revoke, foreign pass revoke) | 404 both |
| mass assignment (branch `tenant_id`/`timezone`/`created_at`, visitor `created_by`/`tenant_id`/`id`) | ignored; server-set values win (privacy script) |
| invalid branch | `BRANCH_NOT_FOUND` |
| invalid institution | refused / empty results |
| malformed QR | `INVALID_QR` |
| huge payload (2 MB credential) | no 5xx, graceful rejection |
| rate abuse | 15 sequential + 10 parallel invalid scans: all `INVALID_QR`, 0 x 5xx; 10-request anonymous burst: all 401 (privacy script) |

### Privacy

| Item | Result |
|---|---|
| small cohort inference | analyzed, no code change (see below) |
| raw user identifiers in management analytics | analytics response contains only aggregates (`totalVisits`, `uniqueUsers`, `byBranch`, `byHour`, `byWeekday`, `visitorVisits`); runtime probe found no email, name, `patron_id`, `user_id`, `full_name`, or `email` keys |
| excessive export | `MAX_EXPORT_ROWS = 5000` cap in `app/api/access/export/route.ts`; columns exclude email/name/patron; export is audited (`access.export` audit row, asserted in e2e-slaas-live) |
| logs leaking QR tokens | static audit: no `logger`/`console` call in `src/server/slaas/*` or `app/api/access/*` touches the credential; `withHandler` logs requestId/method/path/tenant only, never request bodies; runtime: scan success and error responses do not echo the credential string |
| attendance leaked in error responses | anonymous scan (401), student visits (403), unauthorized correction (403), unknown-branch occupancy (404) — responses contain only `{code,message,requestId}`; probes asserted the visit id, patron code, patron name, and patron email are absent |

## Small cohort inference — analysis (no code change)

`uniqueUsers` in a narrow time slice at a single branch can equal 1, which lets a viewer infer who that user was. Mitigation decision:

1. Analytics requires privileged roles (same tier that can already read the full attendance register with exact rows) — the aggregate endpoint adds no exposure beyond the detailed register those roles legitimately hold.
2. The attendance register is a required operational surface (identity confirmation, occupancy duty of care); suppressing aggregate counts would not reduce what privileged officers can already see row-by-row.
3. Export of detailed rows is role-gated and audited, so adding k-anonymity only to the aggregate layer would be cosmetic (security theater), conflicting with the "do not overbuild" directive.

Accepted as a residual P2 consideration if analytics is ever exposed to less-privileged or cross-tenant audiences.

## Rate abuse — residual risk statement

`/api/access/*` endpoints are not covered by the middleware sensitive-path bucket; protection is layered as: anonymous requests fail fast at JWT verification (401, no database work), scan requires a privileged bearer token, credentials are HMAC-signed (not brute-forceable), the 5-second per-identity debounce and idempotency keys cap duplicate work, and `ARCJET_KEY` (when configured) adds IP-level shield on sensitive paths platform-wide. A stolen officer token can generate load, but a stolen privileged token is already a full compromise — rate limiting would not change that outcome. Documented as accepted; revisit if Arcjet is enabled in production (add `/api/access/scan` to `sensitivePrefixes`).

## Observations (P2, non-blocking)

1. Visitor pass `status` is never set to `used`; passes stay `active` until expiry/revocation and remain reusable inside their validity window. Expiry and revocation are enforced and tested; confirm the reuse-inside-window behavior is intended product policy.
2. `used` enum value exists in schema but is unreachable — either wire it on first checkout or remove it in a future migration (cosmetic).

## Re-run

```powershell
$env:E2E_BASE_URL = 'http://localhost:3000'
node scripts\e2e-slaas-privacy-live.mjs
```
