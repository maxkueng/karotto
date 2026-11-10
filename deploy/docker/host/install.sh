#!/usr/bin/env bash
# Installs or updates the host side of the Docker deployment: the compose project in
# /opt/karotto/docker, the karotto, karotto-admin and karotto-update commands, and the
# nightly backup timer. Does not start or restart anything; karotto-update does that.
set -euo pipefail

COMPOSE_DIR=/opt/karotto/docker
BACKUP_DIR=/var/backups/karotto

log() { printf '\033[1;35m[karotto]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[karotto]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo)"
command -v docker >/dev/null || die "docker is not installed"
docker compose version >/dev/null 2>&1 || die "the docker compose plugin is not installed"
command -v node >/dev/null || die "node is not installed; the karotto client runs on the host"

host_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="$(cd "$host_dir/../.." && pwd)"

install_compose() {
  install -d -m 755 /opt/karotto
  install -d -m 700 "$COMPOSE_DIR"
  install -m 644 "$host_dir/../compose.yaml" "$COMPOSE_DIR/compose.yaml"
  if [[ ! -f "$COMPOSE_DIR/.env" ]]; then
    log "writing $COMPOSE_DIR/.env with a new database password"
    local password
    password="$(od -An -tx1 -N24 /dev/urandom | tr -d ' \n')"
    (umask 077 && sed "s#__DB_PASSWORD__#$password#" "$host_dir/env.example" >"$COMPOSE_DIR/.env")
  fi
}

install_commands() {
  log "installing commands and backup timer"
  install -m 755 "$host_dir/karotto" /usr/local/bin/karotto
  install -m 755 "$host_dir/karotto-admin" /usr/local/bin/karotto-admin
  install -m 755 "$host_dir/karotto-update" /usr/local/bin/karotto-update
  install -m 755 "$host_dir/backup.sh" /opt/karotto/backup.sh
  install -d -m 700 "$BACKUP_DIR"
  install -m 644 "$host_dir/karotto-backup.service" /etc/systemd/system/karotto-backup.service
  install -m 644 "$deploy_dir/karotto-backup.timer" /etc/systemd/system/karotto-backup.timer
  systemctl daemon-reload
  systemctl enable --now docker >/dev/null
  systemctl enable --now karotto-backup.timer >/dev/null
}

install_compose
install_commands

log "installed. Start or update with: sudo karotto-update"
