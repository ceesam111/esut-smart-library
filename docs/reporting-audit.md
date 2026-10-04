REPORT WRITER AUDIT (2026-<arg_value>10-04</arg_value>)
=====================================================

EXISTING REPORT TYPES (5 types in src/server/reports/reportWriter.ts):
- circulation — loans table, date range filter, LIMIT 1000
- acquisitions — purchase_orders table, date range filter, LIMIT 1000
- repository — repository_items table, date range filter, LIMIT 1000
- serials — serials_subscriptions table, NO date filter, LIMIT 1000
- fines — fines table, date range filter, LIMIT 1000

REPORT ROUTE:
- POST /api/admin/reports/generate — generate report (global admin only)
  Accepts: { type, startDate, endDate, format? }
  Returns: JSON with report data, or CSV if format=csv

REPORT SERVICE (src/server/reports/reportWriter.ts):
- generateReport(config: ReportConfig): ReportResult
- reportToCsv(data): string — basic CSV conversion with quote escaping
- Uses Supabase admin client for all queries
- All queries bounded at LIMIT 1000
- No pagination beyond the hard cap
- No filter support beyond startDate/endDate date range
- No column selection; returns all columns from the table
- No grouping, sorting, or aggregation beyond raw row retrieval
- No parameterized whitelist; all column names from SELECT are returned as-is

REPORT TYPES & THEIR DATA SOURCES:
- circulation: loans (id, item_id, patron_id, checkout_date, due_date, returned_date, status, fine_amount)
- acquisitions: purchase_orders (id, po_number, supplier_id, status, total_amount, currency, order_date)
- repository: repository_items (id, title, authors, item_type, status, visibility, created_at)
- serials: serials_subscriptions (id, title, issn, publisher, status, start_date, renewal_date)
- fines: fines (id, loan_id, patron_id, amount, status, created_at)

EXISTING LIMITATIONS (from audit):
1. No saved reports — every generation is ad-hoc
2. No filter support beyond date range (no faculty, department, patron type, item type, etc.)
3. No column whitelist/selection — all columns returned
4. No grouping, sorting, or aggregation
5. No pagination beyond LIMIT 1000 hard cap (risks OOM at 1000+ rows)
6. No pagination UI; all rows returned to React
7. No grouping/sorting parameters
8. No report permissions beyond "global admin can run everything"
9. No saved report definitions
10. No scheduling infrastructure (beyond weeklyTenantReport AI job)
11. No XLSX export (only CSV and JSON)
12. No PDF export
13. No CSV formula-injection protection (different from Batch 12 analytics CSV)
14. No duplicate schedule protection
15. No report history / run tracking
16. No parameterized/dataset-based builder
17. No filters by faculty, department, patron type, etc.
18. No built-in report pack (the 5 types exist but are minimally useful)
19. No report builder UI for staff
20. No pagination or "load more" functionality

REPORT TABLES (Supabase):
- report_snapshots: id, section, data (jsonb), recorded_at, recorded_by (auth.users). RLS: authenticated have full access (USING true)
- analytics_events: event tracking (from Batch 12)
- admin_access_log: admin action logging

EXISTING REPORT WORKER:
- weeklyTenantReport: AI-generated weekly summary staged for approval via approval workflow
- Uses workerJsonCompletion with Sysa agent prompt
- Creates approval record; not a "scheduled report" in the Batch 13 sense

BUILT-IN REPORT PACK (minimally useful):
- circulation: current loans with full loan data (but LIMIT 1000, no filters)
- acquisitions: purchase orders with full data (but LIMIT 1000, no filters)
- repository: repository items with full data (but LIMIT 1000, no filters)
- serials: subscriptions with full data (no date filter, LIMIT 1000)
- fines: fines with full data (but LIMIT 1000, no filters)

BATCH 12 CORRELATION:
- Formula-injection protected CSV from Batch 12 (13.39 of this batch)
- Observability and health endpoints
- 20/20 E2E checks passed

KEY GAPS IDENTIFIED:
1. No saved report definitions — every generation is ad-hoc
2. No filter support beyond date range (no faculty, department, patron type, item type, branch, status, etc.)
3. No column whitelist/selection — all columns returned from table scan
4. No grouping, sorting, or aggregation operations
5. No server-side pagination beyond hard LIMIT 1000 (client-side 1000+ rows)
6. No XLSX export (only CSV and JSON)
7. No PDF export
8. No CSV formula-injection protection (the existing reportToCsv lacks escaping for = + - @)
9. No duplicate schedule protection
10. No report history / run tracking
11. No parameterized/dataset-based report builder UI
12. No filters by faculty, department, patron type, item type, branch/library, status, etc.
13. No report permissions differentiation (run vs create vs edit vs schedule)
14. No scheduling infrastructure (daily/weekly/monthly)
15. No saved reports (create/rename/duplicate/edit/delete)
16. No report builder UI where staff can select from approved datasets/fields/columns
17. No pagination with "load more" or infinite scroll
18. No grouping/counts/sums/averages
19. No report preview before saving/exporting
20. No CSV/XLSX export of filtered/sorted/grouped results

EXISTING SCHEMA (key tables):
- loans: id, item_id, patron_id, checkout_date, due_date, returned_date, status, fine_amount
- purchase_orders: id, po_number, supplier_id, status, total_amount, currency, order_date
- repository_items: id, title, authors, item_type, status, visibility, created_at
- serials_subscriptions: id, title, issn, publisher, status, start_date, renewal_date
- fines: id, loan_id, patron_id, amount, status, created_at
- report_snapshots: id, section, data (jsonb), recorded_at, recorded_by
- analytics_events: Batch 12 event tracking