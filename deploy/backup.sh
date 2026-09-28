#!/usr/bin/env bash
# Dumps the karotto database to /var/backups/karotto and keeps the last 30 dumps.
set -euo pipefail
BACKUP_DIR=${BACKUP_DIR:-/var/backups/karotto}
KEEP=${KEEP:-30}
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL is not set" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/karotto-$stamp.sql.gz"
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 >"$target"
chmod 600 "$target"
ls -1t "$BACKUP_DIR"/karotto-*.sql.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "wrote $target"
