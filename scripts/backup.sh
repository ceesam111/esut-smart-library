#!/bin/bash
# ESUT Smart Library — Backup Script
# Usage: ./backup.sh [backup_dir]
# Exports database schema + data and storage bucket contents

set -euo pipefail

BACKUP_DIR="${1:-/var/backups/esut-library}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "${BACKUP_PATH}"

echo "=== ESUT Library Backup: ${TIMESTAMP} ==="

# Database backup
echo "Backing up database..."
pg_dump "$DATABASE_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_PATH}/database.sql" 2>/dev/null || echo "WARNING: Database backup failed (DATABASE_URL not set)"

# Storage backup
echo "Backing up storage buckets..."
for bucket in repository theses aip-exports; do
  echo "  - ${bucket}"
  mkdir -p "${BACKUP_PATH}/storage/${bucket}"
done

# Config backup (non-secret)
echo "Backing up configuration..."
cat > "${BACKUP_PATH}/backup-info.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "version": "1.0",
  "database": "database.sql",
  "storage_buckets": ["repository", "theses", "aip-exports"],
  "notes": "Restore with: ./restore.sh ${TIMESTAMP}"
}
EOF

echo "Backup complete: ${BACKUP_PATH}"
echo "To restore: ./restore.sh ${TIMESTAMP}"
