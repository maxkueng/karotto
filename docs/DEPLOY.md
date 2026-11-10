# Deploying karotto

karotto ships as one image, `ghcr.io/maxkueng/karotto`, built for amd64 and
arm64 on Alpine. It bundles the API, the web app, `karotto-admin` and the
`karotto` client. Postgres runs next to it as a second container. The only
state is the database.

There are two ways to run it:

- **Managed host install** ([§2](#2-managed-host-install)): a Linux box you
  dedicate to it. A script sets up the compose project, host commands for
  updates and admin, and a nightly backup timer. The app listens on
  `127.0.0.1:3210` behind Tailscale Serve or a reverse proxy.
- **Plain compose** ([§4](#4-plain-compose)): a NAS, a Proxmox VM, or any
  machine where you already run containers your own way. Two files and
  `docker compose up -d`.

## 1. Requirements

- Docker Engine with the Compose plugin (`docker compose version`). On Debian
  or Ubuntu: `apt install docker.io docker-compose`.
- For the managed install: systemd, root access, and optionally Node 24 on the
  host if you want the `karotto` client there without going through Docker.
- Memory: the app uses well under 200 MB, plus Postgres. Nothing is built on
  the host, so small machines are fine.
- Disk: about 500 MB for the images, plus the database (low megabytes for one
  user) and backups.
- Network: nothing inbound is required. Tailscale brings the app onto your
  tailnet over an outbound connection. Without Tailscale, ports 80 and 443
  for a reverse proxy.

A cheap cloud VM, a Raspberry Pi 4 or 5, or any always-on machine you already
have all qualify.

## 2. Managed host install

```sh
git clone https://github.com/maxkueng/karotto.git ~/karotto
sudo ~/karotto/deploy/docker/host/install.sh
sudo karotto-update
sudo karotto-admin user create max --timezone Europe/Zurich
curl http://127.0.0.1:3210/api/v1/health
```

`install.sh` is idempotent and starts nothing. It:

- copies `deploy/docker/compose.yaml` to `/opt/karotto/docker` and, on the
  first run only, writes `/opt/karotto/docker/.env` (root-only) with a random
  database password and settings for running behind a TLS proxy on
  `127.0.0.1:3210`;
- installs `karotto-update`, `karotto-admin` and `karotto` in
  `/usr/local/bin`;
- installs and enables `karotto-backup.timer`.

`karotto-update` then pulls the images, starts both containers, waits for
them to report healthy and copies the client out of the image to
`/opt/karotto/client`. Migrations run when the app container starts.

The app is now running on `http://127.0.0.1:3210`. Pick a way to reach it
under [Access](#6-access).

## 3. Day to day

| Task | Command |
|---|---|
| Update | `sudo karotto-update` |
| Logs | `sudo docker compose -f /opt/karotto/docker/compose.yaml logs -f app` |
| Restart | `sudo docker compose -f /opt/karotto/docker/compose.yaml restart app` |
| Create a user / API token | `sudo karotto-admin user create <name>`, `sudo karotto-admin token create <name> --name scripts` |
| Change a password | `sudo karotto-admin user password <name>` |
| Manual backup | `sudo systemctl start karotto-backup` |
| API client | `karotto login --url <url> -u <name>`, then `karotto tasks list` |

`karotto-update` dumps the database before it pulls, then recreates only the
containers whose image or settings changed. Updates are manual on purpose:
migrations run on start and only go forward, so an unattended update could
migrate the database hours after the last backup. Don't add an auto-updater.

`karotto` runs on the host's Node from the copy in `/opt/karotto/client`, so
any user can run it, and agents or scripts on the box need no Docker access.
Without Node on the host, use `sudo docker compose -f
/opt/karotto/docker/compose.yaml exec app karotto <args>`.

### Backups

`karotto-backup.timer` runs `/opt/karotto/backup.sh` nightly around 03:30.
It runs `pg_dump` inside the db container, writes
`/var/backups/karotto/karotto-<UTC stamp>.sql.gz` (root-only) and keeps the
last 30. A dump that fails leaves no file behind and marks the service
failed: `systemctl status karotto-backup`. A dump is a consistent snapshot; a
copy of the Docker volume while Postgres runs is not.

The dumps sit on the same disk as the database. Copy them to another machine
now and then, or schedule it, or a dead disk takes both.

Restore, replacing the current database:

```sh
dc() { sudo docker compose -f /opt/karotto/docker/compose.yaml "$@"; }
dc stop app
dc exec -T db psql -U karotto -d postgres -c 'drop database karotto' -c 'create database karotto owner karotto'
sudo zcat /var/backups/karotto/karotto-<stamp>.sql.gz | dc exec -T db psql -U karotto -d karotto -v ON_ERROR_STOP=1 --quiet
dc start app
```

### Configuration

`/opt/karotto/docker/.env`:

| Variable | Managed default | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | random | Database password; only the two containers use it |
| `KAROTTO_VERSION` | `latest` | Image tag, see [Tags](#5-tags) |
| `KAROTTO_BIND`, `KAROTTO_PORT` | `127.0.0.1`, `3210` | Address and port on the host. Published ports bypass host firewalls, so keep `127.0.0.1` when a proxy on the box is the way in |
| `SECURE_COOKIES` | `true` | Session cookie `Secure` flag; `false` only for plain HTTP on a LAN |
| `TRUST_PROXY` | `true` | Trust `X-Forwarded-*` from Tailscale or the reverse proxy |
| `SESSION_TTL_DAYS` | `365` | Web session lifetime |
| `LOG_LEVEL` | `info` | pino level |
| `COMPOSE_PROJECT_NAME` | `karotto` | Names the containers and the `karotto_karotto-db` volume; don't change it after the first start |

Edit, then `sudo karotto-update` to apply.

## 4. Plain compose

Make a directory, put `deploy/docker/compose.yaml` and
`deploy/docker/env.example` in it, rename the second to `.env`, and set
`POSTGRES_PASSWORD`:

```sh
mkdir karotto && cd karotto
curl -fsSLO https://raw.githubusercontent.com/maxkueng/karotto/master/deploy/docker/compose.yaml
curl -fsSL https://raw.githubusercontent.com/maxkueng/karotto/master/deploy/docker/env.example -o .env
$EDITOR .env
docker compose up -d
docker compose exec app karotto-admin user create max --timezone Europe/Zurich
```

The app is on `http://<host>:3000`. The same variables as in the
[configuration table](#configuration) apply; this `.env` defaults to
`0.0.0.0:3000` and plain HTTP. The client works from inside the container:

```sh
docker compose exec app karotto login --url http://localhost:3000 -u max
docker compose exec app karotto tasks list
```

Update with `docker compose pull && docker compose up -d`, after taking a
backup. Back up and restore:

```sh
docker compose exec -T db pg_dump -U karotto --no-owner --no-privileges karotto | gzip > karotto-$(date +%F).sql.gz
zcat karotto-2026-09-30.sql.gz | docker compose exec -T db psql -U karotto karotto   # into an empty database
```

## 5. Tags

| Tag | What |
|---|---|
| `latest` | Newest release |
| `0.3.0`, `0.3` | A specific release, or its newest patch |
| `edge` | Every push to `master`. Fine for trying things, not for keeping |

Pin `KAROTTO_VERSION` in `.env` if you want every version change to be an
explicit edit, and an easy rollback target.

## 6. Access

The app speaks plain HTTP. It does not terminate TLS and it is not meant to
face the internet directly. Pick one of the following, or anything else that
can proxy to a local port. The examples use the managed install's
`127.0.0.1:3210`; with plain compose it is port `3000`.

### Tailscale

Tailscale puts the app on your tailnet with a real HTTPS certificate and no
open ports, from every device that has the Tailscale client, phone included.
Two ways.

#### As a Tailscale Service (own name, own port 443)

A Service gets its own tailnet address, so the app lives at
`https://karotto.<tailnet>.ts.net` and other services on the same machine
can also use port 443. One-time setup in the Tailscale admin console:

1. Define a tag for the host (for example `tag:server`) under Access
   Controls, `"tagOwners": { "tag:server": ["autogroup:admin"] }`, and add an
   auto-approver so hosts of the service are accepted without a click:

   ```json
   "autoApprovers": {
     "services": { "svc:karotto": ["tag:server"] }
   }
   ```

2. Tag the machine from the console: Machines → the host → Edit ACL tags →
   `tag:server`. Services can only be hosted by tagged devices. Do not run
   `tailscale up` or `tailscale login` afterwards; that re-authenticates the
   node as your user and drops the tag.
3. Services → Define a Service: name `karotto`, port `tcp:443`.
4. On the machine, only after the tag and the service exist:

   ```sh
   sudo tailscale serve --service=svc:karotto --https=443 127.0.0.1:3210
   ```

   If the host does not appear under the service within a minute, the
   advertisement was sent before the tag applied and got dropped; re-send it:

   ```sh
   sudo tailscale serve --service=svc:karotto reset
   sudo tailscale serve --service=svc:karotto --https=443 127.0.0.1:3210
   ```

`tailscale serve status` confirms the mapping; it survives reboots. Requires
Tailscale 1.86 or newer on the host.

#### With plain `tailscale serve` (no admin work)

```sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up                    # prints a login URL, approve it once
sudo tailscale serve --bg https:443 http://127.0.0.1:3210
```

This uses the machine's own name, `https://<machine>.<tailnet>.ts.net`, and
claims the machine's tailnet port 443; a second app needs another port
(`https:8443`). Certificates need MagicDNS and HTTPS enabled once for the
tailnet, which the command tells you about if they are not.

Either way the URL works from every device on the tailnet. Keep
`SECURE_COOKIES=true` and `TRUST_PROXY=true`: the browser talks HTTPS to
Tailscale, and the app reads the client address from the `X-Forwarded-For`
header Tailscale sets.

### A reverse proxy with TLS

For a public hostname, put Caddy (or nginx, Traefik, ...) in front and open
ports 80 and 443. Caddy fetches its own certificates:

```sh
apt install caddy
cat >/etc/caddy/Caddyfile <<'CADDY'
karotto.example.com {
    reverse_proxy 127.0.0.1:3210
}
CADDY
systemctl reload caddy
```

Keep `TRUST_PROXY=true` so rate limiting and logs see real client addresses.

### Plain HTTP on the LAN

For testing, or a network you trust, set `KAROTTO_BIND=0.0.0.0` and
`SECURE_COOKIES=false` in `.env` and use `http://<machine>:3210`. Without the
second setting the browser drops the session cookie over HTTP. Do not do
this on a network you do not control.

## 7. Clients

Every client takes the URL you chose above.

- **Browser:** open the URL and log in.
- **Android app:** enter the URL on the login screen. It creates its own
  long-lived token on login and never stores the password. With Tailscale,
  install the Tailscale app on the phone and join the same tailnet.
- **CLI:** `karotto login --url <url> -u <username>` on any machine with the
  client, including the server itself.
- **Home Assistant:** add the Karotto integration with the URL and your
  credentials. See `docs/HOME_ASSISTANT.md`; on Home Assistant OS with
  Tailscale the Supervisor DNS needs to resolve `*.ts.net` names.

## Build it yourself

```sh
docker build -t karotto .
```

The Dockerfile builds the JavaScript once on the host's architecture and
installs runtime dependencies on the target's, so cross-building is cheap:
`docker buildx build --platform linux/arm64 .` works on an x86 machine. Set
`KAROTTO_VERSION` to a local tag and change `image:` accordingly, or use
`docker compose build` with a `build:` section of your own.
