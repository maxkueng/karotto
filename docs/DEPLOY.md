# Deploying karotto

One Linux box, Postgres on the same machine, the app as a systemd service.
The whole thing is `deploy/install.sh`; everything below explains what it
does and the few manual steps around it. The app listens on localhost only;
how you reach it from your devices is a separate decision, covered under
[Access](#4-access).

## 1. Install

Requirements:

- Debian 12 or newer, or Ubuntu 22.04 or newer, on x86-64 or arm64. The
  installer uses `apt`, NodeSource and systemd; other distributions need the
  same steps done by hand.
- Root access for the installer. The service itself runs as an unprivileged
  `karotto` user.
- Memory: the running app uses well under 200 MB, plus Postgres. Building the
  web app peaks around 800 MB, so a machine with less than 2 GB of RAM needs
  swap; the installer adds a 2 GB swap file on such machines automatically.
- Disk: about 1.5 GB for Node, the checkout with dependencies and Postgres,
  plus backups. The database itself stays in the low megabytes for one user.
- CPU: anything. One core builds the web app in a few minutes and the app
  idles at zero afterwards.
- Network: nothing inbound is required. Tailscale brings the app onto your
  tailnet over an outbound connection. Without Tailscale, ports 80 and 443
  for a reverse proxy.

A cheap cloud VM, a Raspberry Pi 4 or 5, or any always-on machine you already
have all qualify. Note the address; you only ever need it for SSH.

```sh
git clone https://github.com/maxkueng/karotto.git ~/karotto
sudo ~/karotto/deploy/install.sh
```

Clone as your normal user; only the installer needs root. It copies the
checkout to `/opt/karotto/src` and hands it to the service user.

The installer is idempotent. It:

- installs Node 24 (NodeSource), Postgres, git, rsync and a build toolchain
  for the `argon2` native module;
- adds a 2 GB swap file on machines with less than 2 GB of RAM, because the
  web build peaks around 800 MB even though the running app needs a fraction;
- creates the `karotto` system user and `/opt/karotto`;
- creates the `karotto` Postgres role with a random password and the
  `karotto` database, and writes `/etc/karotto/env` (root-owned, readable by
  the service);
- runs `npm ci`, `npm run build`, then prunes dev dependencies;
- installs `karotto.service`, a nightly `karotto-backup.timer`, the
  `karotto-admin` maintenance command and the `karotto` client in
  `/usr/local/bin`;
- applies migrations and starts the service.

Then create your account and check the service answers:

```sh
sudo karotto-admin user create max --timezone Europe/Zurich
curl http://127.0.0.1:3210/api/v1/health
sudo journalctl -u karotto -f
```

That is the whole installation. The app is now running on
`http://127.0.0.1:3210` and nothing else on the machine has changed.

## 2. Day to day

| Task | Command |
|---|---|
| Update to the latest version | `cd ~/karotto && git pull && sudo deploy/install.sh` |
| Logs | `journalctl -u karotto -f` |
| Restart | `systemctl restart karotto` |
| Create a user / API token | `karotto-admin user create <name>`, `karotto-admin token create <name> --name scripts` |
| Change a password | `karotto-admin user password <name>` |
| Manual backup | `systemctl start karotto-backup` |
| Restore a backup | `zcat /var/backups/karotto/karotto-<stamp>.sql.gz \| sudo -u postgres psql karotto` |

Backups land in `/var/backups/karotto` nightly at 03:30, last 30 kept. Copy
them off the box now and then; a disk or VM snapshot is not a consistent
database snapshot, the SQL dump is.

## 3. Configuration

`/etc/karotto/env`:

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | set by installer | Postgres connection string |
| `HOST`, `PORT` | `127.0.0.1`, `3210` | Bind address |
| `STATIC_DIR` | `/opt/karotto/src/packages/web/dist` | Built web app served by the API process |
| `TRUST_PROXY` | `true` | Trust `X-Forwarded-*` from Tailscale or the reverse proxy |
| `SECURE_COOKIES` | on in production | Session cookie `Secure` flag; only turn off for plain HTTP on a LAN |
| `SESSION_TTL_DAYS` | `365` | Web session lifetime |
| `AUTO_MIGRATE` | `true` | Apply migrations on start |
| `LOG_LEVEL` | `info` | pino level |

Edit, then `systemctl restart karotto`.

## 4. Access

The app binds to `127.0.0.1:3210` and speaks plain HTTP. It does not
terminate TLS and it is not meant to face the internet directly. Pick one of
the following, or anything else that can proxy to a local port.

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

Either way the URL works from every device on the tailnet. `TRUST_PROXY=true`
in `/etc/karotto/env` makes the app read the client address from the
`X-Forwarded-For` header Tailscale sets, and the session cookie stays
HTTPS-only, which is right because the browser talks HTTPS to Tailscale.

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

For testing, or a network you trust, set `HOST=0.0.0.0` and
`SECURE_COOKIES=false` in `/etc/karotto/env` and use
`http://<machine>:3210`. Without the second setting the browser drops the
session cookie over HTTP. Do not do this on a network you do not control.

## 5. Clients

Every client takes the URL you chose above.

- **Browser:** open the URL and log in.
- **Android app:** enter the URL on the login screen. It creates its own
  long-lived token on login and never stores the password. With Tailscale,
  install the Tailscale app on the phone and join the same tailnet.
- **CLI:** `karotto login --url <url> -u <username>` on any machine with the
  client, including the server itself, where the installer put it.
- **Home Assistant:** add the Karotto integration with the URL and your
  credentials. See `docs/HOME_ASSISTANT.md`; on Home Assistant OS with
  Tailscale the Supervisor DNS needs to resolve `*.ts.net` names.

## Docker

The same app as a published image, `ghcr.io/maxkueng/karotto`, built for
amd64 and arm64 on Alpine. Use it on a NAS, in a Proxmox VM, or anywhere you
already run containers. It bundles the API, the web app, `karotto-admin` and
the `karotto` client; Postgres runs as a second container.

### Start

Make a directory, put `deploy/docker/compose.yaml` and `deploy/docker/env.example`
in it, rename the second to `.env`, and set `POSTGRES_PASSWORD`:

```sh
mkdir karotto && cd karotto
curl -fsSLO https://raw.githubusercontent.com/maxkueng/karotto/master/deploy/docker/compose.yaml
curl -fsSL https://raw.githubusercontent.com/maxkueng/karotto/master/deploy/docker/env.example -o .env
$EDITOR .env
docker compose up -d
docker compose exec app karotto-admin user create max --timezone Europe/Zurich
```

The app is on `http://<host>:3000`. Migrations run when the container starts.

The image ships the client too, so the CLI works from inside the container:

```sh
docker compose exec app karotto login --url http://localhost:3000 -u max
docker compose exec app karotto tasks list
```

### Tags

| Tag | What |
|---|---|
| `latest` | Newest release |
| `0.2.0`, `0.2` | A specific release, or its newest patch |
| `edge` | Every push to `master`. Fine for trying things, not for keeping |

Pin `KAROTTO_VERSION` in `.env` if you don't want `docker compose pull` to
move you to a new major version unattended.

### Update

```sh
docker compose pull && docker compose up -d
```

### Back up

The only state is the database. A dump from the `db` container is a
consistent backup; a snapshot of the volume is not.

```sh
docker compose exec db pg_dump -U karotto karotto | gzip > karotto-$(date +%F).sql.gz
zcat karotto-2026-09-30.sql.gz | docker compose exec -T db psql -U karotto karotto   # restore
```

### Reach it

Everything under [Access](#4-access) applies: put Tailscale Serve, Caddy or
another TLS proxy in front of port 3000 and set `SECURE_COOKIES=true` and
`TRUST_PROXY=true` in `.env`. Without a proxy, leave `SECURE_COOKIES=false`
or browsers will refuse the session cookie over plain HTTP.

### Build it yourself

```sh
docker build -t karotto .
```

The Dockerfile builds the JavaScript once on the host's architecture and
installs runtime dependencies on the target's, so cross-building is cheap:
`docker buildx build --platform linux/arm64 .` works on an x86 machine.
