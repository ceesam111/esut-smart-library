# Demo Seed UI Test Checklist

- Public homepage shows populated catalogue resources, events, announcements, and posts.
- Catalogue search for `Django`, `Library Automation`, and `Research Methods` returns local records.
- 3D resource cards render title, authors, year, category, and availability.
- Resource detail page opens from catalogue cards.
- Free/external search can still expand to open sources.
- Login succeeds for ESUT super admin, librarian, and student demo accounts.
- Student dashboard shows active/overdue loans and notifications.
- Librarian/admin dashboards show approvals, staging rows, catalogue counts, and overdue activity.
- Patron/admin screens show demo patrons and role assignments.
- Catalogue import/staging screens show clean match, needs review, conflict, and error rows.
- Barcode lookup can use seeded patron/copy codes such as `PAT-ESUT-000001` and `COPY-ESUT-0001-1`.
- Repository page shows published and pending demo theses/projects.
- Harvest page shows sources, runs, candidates, duplicate/rejected cases, and discovery logs.
- Approval queue has pending, approved, and rejected examples.
- Events page shows orientation, citation, workshop, exhibition, and accreditation-review events.
- Blog/news screens show seeded demo posts.
- Reports/charts have non-zero values.
- Cross-tenant checks confirm ESUT and OGLB data use different `tenant_id` values.
