NOTICE INFRASTRUCTURE AUDIT (2026-10-04)
===========================================

EXISTING NOTICE TYPES (5 types in src/server/circulation/notices.ts):
- overdue      — item overdue notice
- due_soon     — reminder before due date
- hold_available  — hold ready for pickup
- receipt      — return confirmation
- fine         — fine assessed notice

NOTICE ROUTES:
- POST /api/circulation/notices — send circulation notice (library admin only)
  Generates content via generateNoticeContent(), sends via sendEmail()

EMAIL SERVICE ARCHITECTURE:
- Centralized in src/server/email/emailService.ts
- Primary: Resend API (configured via RESEND_API_KEY + FROM_EMAIL/RESEND_FROM_EMAIL)
- Fallback: Gmail SMTP (configured via GMAIL_SMTP_USER + GMAIL_SMTP_APP_PASSWORD)
- Rate limit: max 10 recipients per send
- Header-injection protection: rejects \r\n in recipients/subject
- Provider status endpoint: GET /api/admin/email/status (or /api/admin/email/test GET)
- Test send: POST /api/admin/email/test with action=send

EMAIL PROVIDER STATUS:
- Resend: configured when RESEND_API_KEY and FROM_EMAIL/RESEND_FROM_EMAIL are set
- Gmail: configured when GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD are set
- Both may be configured; Resend preferred, Gmail used only when Resend fails/ambiguous
- If neither configured: returns 503 error

EMAIL SANITIZATION / SAFETY:
- validateSendEmailOptions(): rejects \r\n, validates email pattern, max 10 recipients, max subject 500 chars, max HTML 500KB
- htmlToText(): strips script/style tags, collapses whitespace, converts entities
- Idempotency keys via Resend UUID per logical send
- Resend ambiguous-failure handling: does not fall back on uncertain delivery

SUPPORSED CHANNELS:
- email (primary, with Resend + Gmail fallback)
- in-app (via Supabase user_notifications table — see 13.10)
- print (partial: no dedicated print-slip UI; receipt content exists in HTML/text form but no printer-friendly view)

NOTIFICATION TABLES (Supabase):
- notifications: patron_id-based RLS, title/message/type/is_read/action_url
- user_notifications: full own-data CRUD + service_role insert; used for in-app delivery
- coar_notifications: Wave 5 COAR protocol table, insert+select to authenticated

WORKER JOBS:
- communications.ts references resendConfigured in overdue reminder summary job
- weeklyTenantReport: AI-generated weekly summary staged for approval (worker handler)
- No existing worker for scheduled overdue/due-soon/hold-ready notices

OVERDUE/DUE-SOON FLOWS:
- Overdue notice: POST /api/circulation/notices with type=overdue — currently the ONLY wired notice
- Due-soon: generateNoticeContent() supports due_soon type but NO API caller wiring exists
- No scheduled worker for automatic due-soon/overdue dispatch

HOLD NOTIFICATIONS:
- hold_available type exists in generateNoticeContent() but NO API/UI wiring
- No hold-ready notification sent when hold becomes ready

FINE NOTICES:
- fine type exists in generateNoticeContent() but NO API/UI wiring

MISSING UI:
- No staff-facing template management UI
- No template preview functionality
- No variable system for dynamic content
- No filter/enable/disable per notice type
- No delivery history / staff history UI
- No test-send functionality from admin UI
- No hold-ready, fine, or workflow notice wiring

TEMPLATES:
- All 5 notice types have hard-coded content in generateNoticeContent() 
- No database-backed storage; no UI to manage them
- No variable system beyond hard-coded recipient_name/item_title/due_date/library_name
- No version/revision metadata

VARIABLES (currently hard-coded):
- {{recipient_name}} — passed as recipient_name in NoticeInput
- {{item_title}} — passed as item_title in NoticeInput
- {{due_date}} — passed as due_date in NoticeInput
- {{library_name}} — passed as library_name in NoticeInput (optional, defaults to 'ESUT Library')
- {{fine_amount}} — not currently in the variable system

BATCH 12 CORRELATION:
- CSV export with formula-injection protection (13.39)
- Observability metrics (13.15-13.17 from Batch 12)
- 20/20 E2E checks passed

KEY GAPS IDENTIFIED:
1. No database-backed template storage — all 5 types hard-coded
2. No variable system beyond 3-4 static fields
3. No template management UI (create/edit/enable/disable/preview)
4. No template permissions (who can view/edit/create/delete)
5. No in-app delivery beyond the user_notifications table existence
6. No print slip/printer-friendly HTML views
7. No SMS adapter architecture
8. No scheduled/due-soon/overdue worker job
9. No hold-ready notification wiring
10. No workflow notice integration
11. No test-send from UI (only via /api/admin/email/test POST)
12. No delivery logging / retry / duplicate suppression
13. No staff delivery history UI