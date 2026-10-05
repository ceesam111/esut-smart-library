-- Offline circulation idempotency (Batch 14 hardening).
-- circulation_transactions.offline_id carries the client_txn_id for every
-- offline sync row. A partial unique index makes a lost-response insert
-- retry converge on the existing row (error code 23505) instead of
-- writing a duplicate. The online path always writes NULL, so it is
-- unaffected. Applied to LIVE via live-sql on 2026-10-04 (verified in
-- pg_indexes); kept here so fresh environments get the same schema.
create unique index if not exists uq_circulation_transactions_offline_id
  on circulation_transactions (offline_id)
  where offline_id is not null;
