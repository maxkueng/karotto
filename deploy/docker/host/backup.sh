#!/usr/bin/env bash
# Dumps the karotto database from the db container to /var/backups/karotto and keeps the last 30 dumps.
set -euo pipefail
COMPOSE_FILE=${KAROTTO_COMPOSE_FILE:-/opt/karotto/docker/compose.yaml}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/karotto}
KEEP=${KEEP:-30}
umask 077
mkdir -p "$BACKUP_DIR"
target="$BACKUP_DIR/karotto-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
trap 'rm -f "$target.partial"' EXIT
docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U karotto --no-owner --no-privileges karotto | gzip -9 >"$target.partial"
mv "$target.partial" "$target"
ls -1t "$BACKUP_DIR"/karotto-*.sql.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "wrote $target"
