#!/bin/sh
set -eu

for migration in /migrations/*.sql; do
  [ -f "$migration" ] || continue
  echo "Applying $migration"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration"
done
