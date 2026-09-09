# Catalog Admin and IR Admin User Guide

## Catalog Admin

Use `Admin > Library Catalog` for OPAC records: books, purchased journals, e-journals, serials, maps, audio/video, and other held materials.

Use `Admin > Add Catalog Item` for MARC-based entry. Required minimum: ISBN, or Title plus Author. Do not enter theses, dissertations, staff papers, datasets, or conference papers here.

Catalog item public pages show call number, copy count, location, and request actions only.

## IR Admin

Use `Admin > Deposit to IR` for scholarly output: theses, dissertations, staff publications, journal articles, conference papers, datasets, and technical reports.

Before submitting, complete the IR Deposit Checklist. The form requires title, creators, item type, abstract, department, PDF upload, licence, embargo date where applicable, and supervisors for thesis/project deposits.

IR item public pages show Dublin Core style metadata, abstract, creators, licence, citation, download, and embargo status. They do not show call number or copy holdings.

## Department IR Officer

Department IR officers deposit only for their department and use departmental compliance views. They do not manage catalog records.

## Rollout Checklist

1. Deploy staging at `staging.esutlibrary.edu.ng`.
2. Apply the additive migration.
3. Run `npm run migrate:catalog-ir` for dry run.
4. Verify old catalog IDs through `/api/catalog/legacy/{id}`.
5. Enable frontend routes.
6. Configure 301 redirects at the edge/proxy layer.
7. Keep `catalogue_items` untouched for 30 days.
