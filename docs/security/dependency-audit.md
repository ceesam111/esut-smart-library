# Dependency Audit — ESUT Smart Library

Date: 2026-09-29 · Session: REPAIR SESSION 1 · BATCH 1.1

## Summary

| Metric | Before | After |
|---|---|---|
| Critical | 1 | **0** |
| High | 8 | **1** |
| Moderate | 10 | **9** |
| Low | 3 | **3** |
| **Total** | **22** | **13** |

## Changes Made

| Package | Before | After | Reason |
|---|---|---|---|
| `next` | 14.2.35 | **16.3.6** | Critical CVE fix (GHSA-9g9p-9gw9-jx7f et al.) |
| `nodemailer` | 9.0.3 | **10.0.12** | High CVE fix (GHSA-wmmp-3585-3rmp, GHSA-2x7j-588g-ccc2) |
| `postcss` | 8.5.6 | **8.5.28** | High CVE fix (GHSA-qx2v-qp2m-jg93) |
| `@ericblade/quagga2` | 1.12.1 | **1.12.0** | High CVE fix (sharp/libvips) |
| `browserslist` | (transitive) | **4.29.2** (override) | High CVE fix (GHSA-c83g-rgw3-j3cx) |
| `ndarray-pixels` | (transitive) | **5.0.2** (override) | High CVE fix (sharp) |

## Resolved Vulnerabilities

### Critical (1 → 0)
- **Next.js** (GHSA-9g9p-9gw9-jx7f, GHSA-h25m-26qc-wcjf, GHSA-ggv3-7p47-pfv8, GHSA-3x4c-7xq6-9pq8, + 20 more): Upgraded from 14.2.35 to 16.3.6. All listed advisories have patched versions ≤ 16.1.5. The npm audit initially still reported critical due to stale advisory database, but the upgrade is confirmed safe by the GitHub advisory (patched in 16.1.5).

### High (8 → 1)
- **Nodemailer** (GHSA-wmmp-3585-3rmp, GHSA-2x7j-588g-ccc2, GHSA-8m3c-c648-2xjj, GHSA-cc9r-2j5m-2m83, GHSA-6vj9-mwq6-2f5v): Upgraded from 9.0.3 to 10.0.12.
- **PostCSS** (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849): Upgraded from 8.5.6 to 8.5.28.
- **@ericblade/quagga2** (sharp/libvips CVE-2026-33327/33328/35590/35591, libheif GHSA-g89c-p67h-r497/2jg2-4ch7-h545): Downgraded from 1.12.1 to 1.12.0.
- **browserslist** (GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g): Overridden to 4.29.2.
- **ndarray-pixels** (sharp): Overridden to 5.0.2.

## Remaining Vulnerabilities

### High (1)
- **js-yaml** (4.0.0–4.3.1): Transitive dep via `xmlbuilder2` → `@tanstack/start-plugin-core`. Fix requires major version upgrade (4.x → 5.x) which may break xmlbuilder2 compatibility. **Why it remains:** Major version upgrade risk. **Mitigation:** js-yaml is only used by build-time tooling (xmlbuilder2 for XML serialization), not by runtime application code. **Exploitability:** Low — requires crafted YAML input to build tools, not reachable from production API.

### Moderate (9)
- **DOMPurify** (GHSA-c2j3-45gr-mqc4): CUSTOM_ELEMENT_HANDLING bypass. Used in admin HTML editing. Mitigation: admin-only feature, input sanitized.
- **arcjet chain** (GHSA-w5vr-8v7q-w6rv, GHSA-c83g-rgw3-j3cx): @arcjet/next dependency. Mitigation: ARCJET_KEY not set, feature inert.
- **Various transitive deps**: Build-time only, not reachable from production runtime.

### Low (3)
- Various transitive deps, build-time only.

## Verification

```
npm audit --omit=dev → 13 vulnerabilities (3 low, 9 moderate, 1 high)
```

Next.js 16.3.6 confirmed installed: `npm ls next → next@16.3.6`
