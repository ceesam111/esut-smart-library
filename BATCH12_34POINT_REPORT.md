BATCH 12 CLOSURE — 34-Point Report
Commit: 5871cb8 | Base: d086014 | Status: ALL GREEN

1. Federated search event (federated_search) captured server-side via
   /api/search/resources with provider mix metadata
2. Federated result click (federated_result_click) captured client-side
   via /api/events/track beacon, rate-limited, bot-classified, hashed IPs
3. Provider result click (provider_result_click) captured via beacon with
   per-provider failure metadata
4. Faculty filter predicate (.eq()) applied server-side to analytics queries
5. Patron_role filter predicate (.eq()) applied server-side to analytics queries
6. Department filter predicate (.eq()) applied server-side to analytics queries
7. Dashboard response includes filters_applied metadata
8. eventCount() helper with faculty/patron_role/department .eq() chain
9. eventRows() helper with conditional filter predicates
10. Segmentation endpoint GET /api/admin/analytics/segmentation?group_by=faculty|department|patron_role
11. Small-group privacy suppression threshold=5; groups < 5 return SUPPRESSED
12. CSV export endpoint GET /api/admin/analytics/export?report=summary|top_titles|zero_results
13. Formula-injection escaping: =, +, -, @ prefixes quoted in escapeCsvValue()
14. Filter parameters supported in CSV export (faculty=, department=, patron_role=)
15. Observability metrics in captureEvent: eventsAttempted, eventsPersisted, writeFailures
16. botEvents, systemEvents, humanEvents, lastSuccessAt, lastFailureAt
17. Health endpoint GET /api/admin/analytics/health exposing all observability counters
18. Bot classification: captureEvent classifies bot via user-agent patterns, sets bot_flag=BOT
19. IP privacy: SHA-256 hash of client IP via hashIp() before storage
20. Catalogue search event captured server-side (trackCatalogueSearch)
21. Catalogue result click (catalogue_result_click) via client beacon
22. Catalogue view (catalogue_view) beacon on mount after view_count increment
23. Repository item view (repository_item_view) beacon on mount after view_count increment
24. Repository file download (repository_file_download) after successful download
25. Repository download fileService returns itemId + fileId
26. Circulation checkout beacon after logCirculationEvent (incl. offline sync)
27. Circulation checkin beacon after logCirculationEvent
28. Federated search endpoint with provider mix metadata and failure handling
29. Rate-limited /api/events/track beacon with event-type whitelist and metadata sanitization
30. 23 new deterministic tests: batch12.test.ts (20) + route.test.ts (3)
31. Full vitest suite: 532 passed, 0 failed (all batches combined)
32. tsc --noEmit: 0 errors; npm run build: PASS
33. EXPLAIN spot-checks: all analytics queries use index-supported access patterns
34. Live E2E: 20/20 checks passed (dashboard, filters, segmentation, zero-result, bot, CSV, health, federated)

All 12C gaps closed. No Batch 13 initiated.