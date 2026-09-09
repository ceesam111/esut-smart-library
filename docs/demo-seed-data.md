# Demo Seed Data

## What Gets Seeded

- ESUT Smart Library and OGLB Digital Library tenant-scoped data.
- Optional DPL tenant with `DPL` or `--all-tenants`.
- Fake Auth users, patrons, librarians, lecturers, admin staff, and students.
- Role assignments for `super_admin`, `librarian`, `faculty_librarian`, `researcher_lecturer`, `student`, and `admin_staff`.
- Departments, programmes, shelves, catalogue resources, copy barcodes, loans, fines, reservations, repository records, import batches, staging rows, harvest sources/runs/candidates, approvals, events, posts, announcements, notifications, agent runs/jobs, audit logs, and B2 object metadata placeholders.

## Safety

- No real PII is used.
- Service role is used only by CLI scripts.
- Seed refuses to run unless `SEED_TARGET` is `development`, `staging`, or `demo`.
- Reset refuses to run unless `SEED_ALLOW_RESET=I_UNDERSTAND_THIS_WILL_DELETE_DEMO_DATA_ONLY`.
- Reset targets deterministic demo identifiers only.

## Run

```powershell
$env:SEED_TARGET="demo"
npm run seed:demo
npm run seed:demo:verify
```

Seed one tenant:

```powershell
$env:SEED_TARGET="demo"
npm run seed:demo:tenant -- ESUT
```

Reset:

```powershell
$env:SEED_TARGET="demo"
$env:SEED_ALLOW_RESET="I_UNDERSTAND_THIS_WILL_DELETE_DEMO_DATA_ONLY"
npm run seed:demo:reset
```

## Demo Accounts

All demo passwords are `ChangeMe123!`.

- ESUT Super Admin: `admin.esut@example.edu.ng`
- ESUT Librarian: `librarian001.esut@example.edu.ng`
- ESUT Student: `student001.esut@example.edu.ng`
- OGLB Super Admin: `admin.oglb@oglb.test`
- OGLB Librarian: `librarian001.oglb@oglb.test`
- OGLB Student: `student001.oglb@oglb.test`

Change these passwords before any production demonstration outside a controlled test environment.

## Expected Dashboard Data

- Catalogue has at least 30 resources per default tenant.
- Copies have barcode values such as `COPY-ESUT-0001-1`.
- Loans include active, returned, and overdue examples.
- Approval queue includes pending, approved, and rejected examples.
- Catalogue staging includes clean, review, conflict, and error scenarios.
- Harvest screens include OpenAlex/DOAB candidates and discovery logs.
- Reports/charts have varied `created_at` dates across recent months.

## Troubleshooting

- If catalogue says schema is not ready, open `/api/health/schema`.
- If login fails, rerun seed with `SEED_TARGET=demo` and verify Auth users were created.
- If reset is refused, set the exact reset confirmation variable shown above.
