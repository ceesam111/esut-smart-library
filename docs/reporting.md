# Report Writer

## Datasets

- **circulation** — loans table (id, item_id, patron_id, checkout_date, due_date, returned_date, status, fine_amount)
- **patrons** — patrons table (id, user_id, first_name, last_name, email, phone, faculty, department, patron_role, status, account_expiry)
- **catalogue** — catalogue_items table (id, title, author, isbn, faculty_code, department, status, collection, location)
- **repository** — repository_items table (id, title, authors, item_type, status, visibility)
- **acquisitions** — purchase_orders table (id, po_number, supplier_id, status, total_amount, currency, order_date)
- **serials** — serials_subscriptions table (id, title, issn, publisher, status, start_date, renewal_date)
- **analytics** — analytics_events table (id, event_type, patron_id, entity_id, search_query, bot_flag)
- **fines** — fines table (id, loan_id, patron_id, amount, status)

## Report Builder

Staff can build reports by selecting:
- Dataset (from approved list)
- Columns (from whitelist per dataset)
- Filters (field, operator, value)
- Sorting (field, direction)
- Grouping (field, aggregations)

## Built-in Reports

- Current Loans
- Overdue Loans
- Checkouts by Period
- Most Borrowed Titles
- Patrons by Category
- Expiring Accounts
- Items by Status
- Recently Added
- Submissions by Status
- Publications by Period
- Orders by Status
- Active Subscriptions

## Export Formats

- **CSV** — formula-injection protected
- **XLSX** — tab-separated values in spreadsheet format

## Saved Reports

Reports can be saved with name, description, filters, columns, sorting, and visibility (private/shared/public).

## Scheduling

Reports can be scheduled (daily/weekly/monthly) via worker queue. Schedule history tracks run time, status, row count, and delivery result.

## Permissions

- Run reports: global admin
- Create/save reports: global admin
- Edit own reports: owner
- Edit shared reports: owner or shared visibility
- Schedule: global admin
- View sensitive patron reports: restricted

## API Endpoints

- `POST /api/admin/reports/builder` — run/export/save/list/get/delete/history
- `POST /api/admin/reports/generate` — legacy report generation

## Known Limitations

- No PDF export
- No email delivery of scheduled reports (in-app notification only)
- XLSX export is TSV-based (not true OOXML)
