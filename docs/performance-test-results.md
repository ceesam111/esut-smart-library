# Performance Test Results

**Date:** 2026-09-28
**Base URL:** https://virtuallibrary.esut.edu.ng
**Tool:** Python urllib (VPS-local)

## Summary

| Metric | Value |
|---|---|
| Endpoints tested | 10 |
| Successful | 10 |
| Failed | 0 |
| Avg response | 209ms |
| Min response | 29ms |
| Max response | 581ms |

## Results

| Endpoint | Status | Time (ms) | Size (b) |
|---|---|---|---|
| OAI-PMH Identify | 200 | 581 | 681 |
| OAI-PMH ListSets | 200 | 171 | 410 |
| SRU Explain | 200 | 32 | 1622 |
| Repository List | 200 | 170 | 43 |
| Catalogue Search | 200 | 219 | 40 |
| Licenses | 200 | 143 | 831 |
| Authorities | 200 | 173 | 26 |
| ROR Search | 200 | 109 | 26 |
| ORCID Validate | 200 | 470 | 182 |
| SWORD Service | 200 | 29 | 796 |

## Analysis

- **Fastest:** SWORD Service (29ms) — static XML, no DB
- **Slowest:** OAI-PMH Identify (581ms) — DB query for earliest datestamp
- **External APIs:** ROR (109ms), ORCID (470ms) — dependent on third-party latency
- **DB-backed:** 140-220ms range — acceptable for a platform this size

## Recommendations

1. Add caching for OAI-PMH Identify (earliest datestamp changes rarely)
2. Add caching for SWORD service document (static content)
3. Consider CDN for static assets
4. Monitor external API latency (ORCID, ROR) — implement timeouts + fallbacks
