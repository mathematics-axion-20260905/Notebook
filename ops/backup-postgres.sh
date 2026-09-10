#!/usr/bin/env bash
set -euo pipefail

: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

backup_dir="${BACKUP_DIR:-/var/backups/axion-notebook}"
service_name="${SERVICE_NAME:-axion-notebook}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="$backup_dir/${service_name}-${stamp}.dump"

umask 077
install -d -m 700 "$backup_dir"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --host="${DB_HOST:-127.0.0.1}" \
  --port="${DB_PORT:-5432}" \
  --username="$DB_USER" \
  --file="$dump_file" \
  "$DB_NAME"
sha256sum "$dump_file" > "$dump_file.sha256"

find "$backup_dir" -type f -name '*.dump' -mtime +14 -delete
find "$backup_dir" -type f -name '*.dump.sha256' -mtime +14 -delete
printf 'Created %s\n' "$dump_file"
