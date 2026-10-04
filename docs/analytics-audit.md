# Analytics Pre-Change Audit

## Current State

The analytics system is **architecturally complete but operationally inert**. The database schema, API layer, service functions, and dashboard UI are all properly built, but `recordEvent()` has ZERO callers, so the `analytics_events` table is empty and the dashboard always shows zeros.

## Existing Schema

`analytics_events` table with columns: id, event_type, user_id, session_id, ip_hash, user_agent, referrer, path, metadata, created_at.

Event types: page_view, search, download, view_item, login, register.

## What Exists

- `analytics_events` table (empty)
- `recordEvent()` function (0 callers)
- `getAnalyticsSummary()` function (active)
- `/api/admin/analytics` API (active)
- Analytics dashboard UI (active, shows zeros)
- Platform metrics (active, shows zeros)
- COUNTER R5 report generator (empty output)
- Domain report generator (active)
- Catalogue stats (collection composition only)
- Circulation audit logging (separate audit_logs table)

## What's Missing

- Page view capture
- Search event capture
- Download event capture
- Login/register capture
- Repository view/download tracking
- Catalogue view tracking
- Patron activity tracking
- Bot filtering
- Server-side aggregations for all KPIs
- Real dashboard data
- CSV export
- Analytics permissions
- Event retention policy
- Observability for analytics failures

## Batch 12 Closure Update (2026-10-03)

The following gaps are now CLOSED:

- Federated search events: `federated_search`, `federated_result_click`, `provider_result_click` captured with provider mix and provider failure metadata
- Faculty/patron-role/department filters: applied server-side to dashboard, search analytics, and CSV export queries
- Segmentation: `/api/admin/analytics/segmentation` with small-group privacy suppression (threshold: 5 events)
- CSV export: `/api/admin/analytics/export` with formula-injection escaping (`=`, `+`, `-`, `@` prefixes)
- Observability: in-memory write metrics (attempted/persisted/failed/bot/human) exposed at `/api/admin/analytics/health`
- Live event wiring: catalogue search (server-side in `/api/search/resources`), catalogue result clicks and views, repository item views and file downloads, circulation checkout/checkin (including offline sync), federated search and result clicks
- Bot classification: crawler/monitoring user agents flagged `BOT` at capture time
- IP privacy: client IPs are SHA-256 hashed before storage

### Verified Live (2026-10-03)

- 20/20 live E2E checks passed against the dev server (dashboard, filters, segmentation, zero-result, bot, CSV, health, federated)
- EXPLAIN spot-checks: all analytics queries use index-supported access patterns
