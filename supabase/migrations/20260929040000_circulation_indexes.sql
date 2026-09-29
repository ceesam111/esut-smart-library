-- BATCH 3: Add indexes on circulation FK columns for query performance
-- These indexes support hot-path queries: checkout lookup, active loans by patron,
-- holds queue, overdue loans, and circulation history.

-- circulation_transactions: 3 FK columns without indexes
create index if not exists idx_circ_trans_catalogue_item on public.circulation_transactions(catalogue_item_id);
create index if not exists idx_circ_trans_loan on public.circulation_transactions(loan_id);
create index if not exists idx_circ_trans_patron on public.circulation_transactions(patron_id);

-- fines: patron_id FK without index
create index if not exists idx_fines_patron on public.fines(patron_id);

-- payments: fine_id and patron_id FKs without indexes
create index if not exists idx_payments_fine on public.payments(fine_id);
create index if not exists idx_payments_patron on public.payments(patron_id);

-- reservations: 3 FK columns without indexes
create index if not exists idx_reservations_catalogue_item on public.reservations(catalogue_item_id);
create index if not exists idx_reservations_loan on public.reservations(loan_id);
create index if not exists idx_reservations_patron on public.reservations(patron_id);
