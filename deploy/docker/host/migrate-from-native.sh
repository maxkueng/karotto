#!/usr/bin/env bash
# One-time move from the systemd deployment (deploy/install.sh) to Docker on the same host.
# Stops the native service, dumps the native database, restores it into the db container and
# starts the container on the same 127.0.0.1:3210, so a proxy in front needs no change.
set -euo pipefail

COMPOSE_FILE=/opt/karotto/docker/compose.yaml
BACKUP_DIR=/var/backups/karotto

log() { printf '\033[1;35m[karotto]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[karotto]\033[0m %s\n' "$*" >&2; exit 1; }
dc() { docker compose -f "$COMPOSE_FILE" "$@"; }

[[ $EUID -eq 0 ]] || die "run as root (sudo)"
systemctl is-active --quiet postgresql || die "native postgresql is not running; nothing to migrate from"

host_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dump="$BACKUP_DIR/pre-docker-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

"$host_dir/install.sh"

log "pulling images"
dc pull --quiet
log "starting the db container"
dc up --detach --wait db
tables="$(dc exec -T db psql -U karotto -d karotto -tAc \
  "select count(*) from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema')")"
[[ "$tables" == 0 ]] || die "the db container already has $tables tables; refusing to restore over them"

log "stopping the native service"
trap 'printf "\nmigration failed; native data is untouched. Back to native: sudo docker compose -f %s down && sudo systemctl enable --now postgresql karotto\n" "$COMPOSE_FILE" >&2' ERR
systemctl disable --now karotto
log "dumping the native database to $dump"
(umask 077 && sudo -u postgres pg_dump --no-owner --no-privileges karotto | gzip -9 >"$dump")

log "restoring into the db container"
zcat "$dump" | dc exec -T db psql -U karotto -d karotto -v ON_ERROR_STOP=1 --quiet >/dev/null

/usr/local/bin/karotto-update

curl -fsS http://127.0.0.1:3210/api/v1/health >/dev/null || die "health check on 127.0.0.1:3210 failed"
log "stopping native postgresql (still installed, data untouched)"
systemctl disable --now postgresql

cat <<MSG

Done. karotto now runs in Docker on 127.0.0.1:3210.
  sudo karotto-update            update: backup, pull, restart
  sudo karotto-admin user list   admin commands
  sudo docker compose -f $COMPOSE_FILE logs -f app

Rollback (loses anything written since the cutover):
  sudo docker compose -f $COMPOSE_FILE down
  sudo systemctl enable --now postgresql karotto
  # the native backup timer and commands come back with deploy/install.sh from v0.3.0 or older
The native dump is $dump.
MSG
