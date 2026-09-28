#!/usr/bin/env bash
# Installs or updates karotto on a Debian/Ubuntu host as a systemd service.
# Idempotent: run it again after `git pull` to deploy a new version.
set -euo pipefail

APP_USER=karotto
INSTALL_DIR=/opt/karotto/src
ENV_FILE=/etc/karotto/env
BACKUP_DIR=/var/backups/karotto
NODE_MAJOR=24
DB_NAME=karotto
DB_USER=karotto

log() { printf '\033[1;35m[karotto]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[karotto]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo)"
command -v apt-get >/dev/null || die "this installer targets Debian/Ubuntu"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"
systemd_available=1
[[ "${KAROTTO_NO_SYSTEMD:-0}" == "1" ]] && systemd_available=0

install_packages() {
  log "installing system packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends ca-certificates curl gnupg git rsync sudo postgresql postgresql-contrib build-essential python3 >/dev/null
  if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]]; then
    log "installing Node.js $NODE_MAJOR from NodeSource"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi
  log "node $(node --version), npm $(HOME=/root npm --version)"
}

ensure_swap() {
  local total_kb
  total_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  if [[ "$total_kb" -ge 1900000 ]] || [[ -f /swapfile ]] || swapon --show | grep -q .; then
    return 0
  fi
  log "less than 2 GB of RAM: adding a 2 GB swap file so the web build fits"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
}

create_user() {
  if ! id -u "$APP_USER" >/dev/null 2>&1; then
    log "creating system user $APP_USER"
    useradd --system --home-dir /opt/karotto --create-home --shell /usr/sbin/nologin "$APP_USER"
  fi
  mkdir -p /opt/karotto /etc/karotto "$BACKUP_DIR"
  chown "$APP_USER:$APP_USER" /opt/karotto "$BACKUP_DIR"
  chown root:"$APP_USER" /etc/karotto
  chmod 750 /etc/karotto
}

sync_source() {
  if [[ "$source_dir" == "$INSTALL_DIR" ]]; then
    return
  fi
  log "copying checkout to $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  rsync -a --delete --exclude node_modules --exclude '*/node_modules' --exclude .env --exclude 'packages/android' "$source_dir/" "$INSTALL_DIR/"
  chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
}

setup_database() {
  if [[ $systemd_available -eq 1 ]]; then
    systemctl enable --now postgresql >/dev/null
  fi
  local password
  if [[ -f "$ENV_FILE" ]] && grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    password="$(sed -n 's#^DATABASE_URL=postgres://[^:]*:\([^@]*\)@.*#\1#p' "$ENV_FILE")"
  else
    password="$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n')"
  fi
  if ! sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='$DB_USER'" | grep -q 1; then
    log "creating database role $DB_USER"
    sudo -u postgres psql -qc "create role $DB_USER login password '$password'"
  else
    sudo -u postgres psql -qc "alter role $DB_USER password '$password'"
  fi
  if ! sudo -u postgres psql -tAc "select 1 from pg_database where datname='$DB_NAME'" | grep -q 1; then
    log "creating database $DB_NAME"
    sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    log "writing $ENV_FILE"
    sed "s#__DB_PASSWORD__#$password#" "$script_dir/env.example" >"$ENV_FILE"
    chown root:"$APP_USER" "$ENV_FILE"
    chmod 640 "$ENV_FILE"
  fi
}

build_app() {
  log "installing dependencies and building"
  sudo -u "$APP_USER" -H bash -c "cd '$INSTALL_DIR' && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent"
  log "pruning development dependencies"
  sudo -u "$APP_USER" -H bash -c "cd '$INSTALL_DIR' && npm ci --omit=dev --workspace @karotto/server --no-audit --no-fund --loglevel=error"
}

install_units() {
  install -m 755 "$script_dir/karotto" /usr/local/bin/karotto
  install -m 755 "$script_dir/backup.sh" /opt/karotto/backup.sh
  [[ $systemd_available -eq 1 ]] || return 0
  log "installing systemd units"
  install -m 644 "$script_dir/karotto.service" /etc/systemd/system/karotto.service
  install -m 644 "$script_dir/karotto-backup.service" /etc/systemd/system/karotto-backup.service
  install -m 644 "$script_dir/karotto-backup.timer" /etc/systemd/system/karotto-backup.timer
  systemctl daemon-reload
}

migrate_and_start() {
  log "applying migrations"
  /usr/local/bin/karotto migrate
  [[ $systemd_available -eq 1 ]] || return 0
  systemctl enable --now karotto-backup.timer >/dev/null
  systemctl enable karotto >/dev/null
  systemctl restart karotto
  sleep 1
  if systemctl is-active --quiet karotto; then
    log "karotto is running: $(systemctl show -p ActiveState --value karotto)"
  else
    journalctl -u karotto -n 30 --no-pager
    die "karotto failed to start"
  fi
}

install_packages
ensure_swap
create_user
sync_source
setup_database
build_app
install_units
migrate_and_start

cat <<MSG

Done. Next steps:
  sudo karotto user create <username> --timezone Europe/Zurich
  sudo journalctl -u karotto -f
The app listens on 127.0.0.1:3210; put Cloudflare Tunnel or a reverse proxy in front (see docs/DEPLOY.md).
MSG
