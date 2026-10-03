# Analytics Event Taxonomy

## Event Categories

### CATALOGUE
- `catalogue_view` — catalogue detail page view
- `catalogue_search` — catalogue search performed
- `catalogue_result_click` — user clicked a search result
- `catalogue_export` — catalogue record exported

### REPOSITORY
- `repository_item_view` — repository item metadata view
- `repository_search` — repository search performed
- `repository_result_click` — user clicked a repository search result
- `repository_file_download` — repository file downloaded (successful)
- `repository_submission` — repository item submitted
- `repository_publication` — repository item published

### CIRCULATION
- `checkout` — item checked out
- `checkin` — item checked in
- `renewal` — loan renewed
- `hold_placed` — hold placed
- `hold_fulfilled` — hold fulfilled
- `hold_cancelled` — hold cancelled
- `overdue` — loan became overdue

### ENGAGEMENT
- `event_view` — event detail view
- `event_registration` — event registration
- `blog_view` — blog post view
- `forum_activity` — forum post/reply

### DISCOVERY
- `federated_search` — federated search performed
- `federated_result_click` — user clicked federated result
- `provider_result_click` — user clicked provider result

### AI
- `ai_session_started` — AI session started
- `ai_query` — AI query performed

### SYSTEM
- `page_view` — generic page view
- `login` — user login
- `register` — user registration

## Event Classification

Each event is classified as:
- `HUMAN` — real user activity
- `BOT` — known crawler/bot
- `SYSTEM` — automated system process (OAI harvester, health checks)

## Privacy

- No passwords, tokens, or private document contents
- No full signed URLs
- No unnecessary IP storage (use hashed/truncated form)
- No sensitive patron notes
- Raw events retained for configurable period
- Aggregates retained longer
