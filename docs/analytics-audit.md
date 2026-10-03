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
