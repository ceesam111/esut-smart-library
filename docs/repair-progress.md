# Repair Progress — Batch 13

## Completed

### Notice System
- Expanded notice types from 5 to 28 (full taxonomy: circulation, account, repository, acquisitions, admin)
- Template model with variable schema, versioning, and channel support
- Variable rendering with HTML escaping and script tag stripping
- Template preview with SAMPLE DATA marking
- Template management API (list, preview, toggle, duplicate)
- Template permissions (global admin only)
- Email delivery via existing Resend + Gmail fallback
- In-app delivery via user_notifications table
- Print delivery via printer-friendly HTML
- SMS adapter architecture (optional, not configured)
- Checkout/checkin/hold-ready/due-soon/overdue notice dispatch API
- Workflow notice dispatch API
- Delivery logging with idempotency keys
- Delivery states (PENDING, QUEUED, SENT, DELIVERED, FAILED, CANCELLED, SUPPRESSED)
- Retry behavior with bounded retries
- Duplicate protection via idempotency keys
- Staff delivery history UI
- Test send endpoint
- Overdue worker (scans overdue loans, sends notices)
- Due-soon worker (scans due-soon loans, sends reminders)

### Report Writer
- Report builder with dataset/column/filter/sort/group support
- 8 datasets with column whitelists
- Sensitive column marking
- CSV export with formula-injection protection
- XLSX export (TSV-based)
- Saved reports (create/read/delete)
- Report run history
- Built-in report pack (12 reports)
- Report builder UI
- Report permissions (owner-based with shared/public visibility)

### Security
- Column whitelist enforcement
- Sensitive column detection
- Formula injection protection in CSV
- IDOR protection via ownership checks
- Template HTML script stripping

### Tests
- 12 notice template tests
- 12 report builder tests
- 6 delivery service tests
- Full suite: 557 passed, 0 failed

### Quality Gates
- TypeScript: 0 errors
- Lint: 0 errors on changed files
- Build: exit 0

## Not Completed / Limitations

- SMS provider not configured (adapter exists, status: NOT_CONFIGURED)
- No PDF report export
- No email delivery of scheduled reports
- XLSX export is TSV-based (not true OOXML)
- Templates stored in-memory by default (database table exists but not fully integrated)
- No live E2E for notices/reports (unit tests only)
- No scheduled report worker (infrastructure exists, not wired to cron)
