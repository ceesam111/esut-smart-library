# Database Performance — ESUT Smart Library

Date: 2026-09-29 · Session: REPAIR SESSION 1 · BATCH 3

## Circulation Index Audit

### Missing FK Indexes (Before)

| Table | Column | FK To | Justification |
|---|---|---|---|
| circulation_transactions | catalogue_item_id | catalogue_items.id | Item lookup in circulation history |
| circulation_transactions | loan_id | loans.id | Loan detail joins |
| circulation_transactions | patron_id | patrons.id | Patron circulation history |
| fines | patron_id | patrons.id | Patron fines lookup |
| payments | fine_id | fines.id | Payment-fine joins |
| payments | patron_id | patrons.id | Patron payment history |
| reservations | catalogue_item_id | catalogue_items.id | Item reservation queue |
| reservations | loan_id | loans.id | Active loan reservation check |
| reservations | patron_id | patrons.id | Patron reservations lookup |

### Indexes Added

Migration `20260929040000_circulation_indexes.sql` — 9 indexes created:

```sql
CREATE INDEX idx_circ_trans_catalogue_item ON circulation_transactions(catalogue_item_id);
CREATE INDEX idx_circ_trans_loan ON circulation_transactions(loan_id);
CREATE INDEX idx_circ_trans_patron ON circulation_transactions(patron_id);
CREATE INDEX idx_fines_patron ON fines(patron_id);
CREATE INDEX idx_payments_fine ON payments(fine_id);
CREATE INDEX idx_payments_patron ON payments(patron_id);
CREATE INDEX idx_reservations_catalogue_item ON reservations(catalogue_item_id);
CREATE INDEX idx_reservations_loan ON reservations(loan_id);
CREATE INDEX idx_reservations_patron ON reservations(patron_id);
```

### Indexes Rejected

None — all 9 FK columns on circulation tables justified indexing based on query patterns.

## Query Plan Notes

With 0 production loans/patrons, EXPLAIN ANALYZE would show seq scans regardless. Indexes will demonstrate benefit at scale (10k+ rows). Index creation verified via psql: all 9 CREATE INDEX statements succeeded.
