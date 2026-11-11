#!/bin/bash
set -euo pipefail
DB='postgres://postgres.rnnjspkdhojoigncdgmy:pxO1ABR4PFyz2q80@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'

psql "$DB" -v ON_ERROR_STOP=1 -f /tmp/apply-cols.lf.sql

echo '=== verify ==='
psql "$DB" -Atc "select 'catalogue.issn=' || (select count(*)::text from information_schema.columns where table_name='catalogue_items' and column_name='issn')"
psql "$DB" -Atc "select 'repository.handle=' || (select count(*)::text from information_schema.columns where table_name='repository_items' and column_name='handle')"
psql "$DB" -Atc "select 'repository.license=' || (select count(*)::text from information_schema.columns where table_name='repository_items' and column_name='license')"
