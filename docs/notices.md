# Notice System

## Notice Types

### Circulation
- `checkout_receipt` — sent after successful checkout
- `checkin_receipt` — sent after successful check-in
- `due_soon` — reminder before due date (default: 3 days)
- `overdue` — item overdue notice
- `overdue_escalation` — escalation at 7/30 days overdue
- `hold_ready` — hold available for pickup
- `hold_cancelled` — hold cancelled
- `renewal_confirmation` — renewal confirmed
- `fine_notice` — fine assessed

### Account
- `welcome` — new account created
- `email_verification` — email verification
- `password_reset` — password reset
- `account_expiry` — account expiring
- `account_restriction` — account restricted

### Repository
- `submission_received` — submission received
- `reviewer_assigned` — reviewer assigned
- `changes_requested` — changes requested
- `returned_for_correction` — returned for correction
- `approved` — submission approved
- `rejected` — submission rejected
- `published` — submission published

### Acquisitions/Serials
- `claim_notice` — claim notice
- `order_notice` — order status update
- `vendor_notice` — vendor message

### Admin
- `custom_notice` — custom admin notice

## Channels

- **email** — Resend primary, Gmail SMTP fallback
- **in-app** — user_notifications table
- **print** — printer-friendly HTML
- **sms** — optional adapter (not configured)

## Template Variables

All templates support `{{variable}}` syntax. Variables are validated before rendering. Unknown required variables fail clearly.

Common variables: `patron_name`, `item_title`, `due_date`, `return_date`, `fine_amount`, `hold_pickup_location`, `library_name`, `repository_title`, `workflow_status`.

## Delivery States

PENDING → QUEUED → SENT → DELIVERED
                           → FAILED (retryable)
                           → SUPPRESSED (not sent)
                           → CANCELLED

## Duplicate Protection

Idempotency keys prevent duplicate sends:
- `overdue:{loan_id}:{stage}`
- `due_soon:{loan_id}:{due_date}`
- `hold_ready:{hold_id}`
- `workflow:{instance_id}:{action_id}:{notice_type}`

## API Endpoints

- `POST /api/circulation/notices` — render notice (library admin)
- `GET /api/admin/notices/templates` — list templates (global admin)
- `POST /api/admin/notices/templates` — preview/toggle/duplicate template
- `POST /api/admin/notices/test-send` — send test notice
- `GET /api/admin/notices/test-send` — delivery history
- `POST /api/admin/notices/dispatch` — dispatch circulation notice
- `POST /api/admin/notices/workflow` — dispatch workflow notice

## Worker Jobs

- `notices.overdue` — scans overdue loans, sends notices
- `notices.dueSoon` — scans due-soon loans, sends reminders

## Known Limitations

- SMS provider not configured (adapter interface exists)
- Templates stored in-memory by default; database-backed via notice_templates table
- No PDF export for notices
