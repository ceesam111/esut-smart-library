-- Batch 15: SIP2 concurrency guard.
-- One active (active/overdue) loan per patron+item. The SIP2 checkout path
-- already does optimistic availability claims; this partial unique index is the
-- DB-level backstop against two self-check stations racing the same checkout.
-- Pre-checked live (2026-10-05): 0 active/overdue loans, so no duplicates exist.

create unique index if not exists loans_one_active_per_patron_item
  on loans (patron_id, catalogue_item_id)
  where status in ('active', 'overdue');
