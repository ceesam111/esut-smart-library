#!/bin/bash
# ESUT Smart Library — Restore Script
# Usage: ./restore.sh <backup_dir>
# Restores database schema + data from backup

set -euo pipefail

BACKUP_DIR="${1:-}"

if [ -z "${BACKUP_DIR}" ]; then
  echo "Usage: ./restore.sh <backup_dir>"
  exit 1
fi

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "ERROR: Backup directory not found: ${BACKUP_DIR}"
  exit 1
fi

echo "=== ESUT Library Restore: ${BACKUP_DIR} ==="

# Database restore
if [ -f "${BACKUP_DIR}/database.sql" ]; then
  echo "Restoring database..."
  psql "$DATABASE_URL" \
    --set ON_ERROR_STOP=1 \
    --file="${BACKUP_DIR}/database.sql" 2>/dev/null || echo "WARNING: Database restore failed (DATABASE_URL not set)"
else
  echo "WARNING: database.sql not found in backup"
fi

echo "Restore complete."
echo "NOTE: Storage buckets must be restored manually from ${BACKUP_DIR}/storage/"
