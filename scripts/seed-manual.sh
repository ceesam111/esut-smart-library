#!/bin/bash
set -euo pipefail
DB='postgres://postgres.rnnjspkdhojoigncdgmy:pxO1ABR4PFyz2q80@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'
tr -d '\r' < /tmp/seed-manual.sql > /tmp/seed-manual.lf.sql
psql "$DB" -v ON_ERROR_STOP=1 -f /tmp/seed-manual.lf.sql
psql "$DB" -Atc "select key || ' -> ' || left(value->>'title', 60) from app_settings where key='library_manual'"
psql "$DB" -Atc "select 'manual body length=' || length(value->>'body') from app_settings where key='library_manual'"
