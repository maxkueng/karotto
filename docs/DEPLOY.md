# Deploying karotto

karotto ships as one image, `ghcr.io/maxkueng/karotto`, built for amd64 and
arm64 on Alpine. It bundles the API, the web app, `karotto-admin` and the
`karotto` client. Postgres runs next to it as a second container.
`docker/compose.yaml` wires the two together. The only state is the
database.

## 1. Requirements

- Docker Engine with the Compose plugin (`docker compose version`).
- Memory: the app uses well under 200 MB, plus Postgres. Nothing is built on
  the host, so small machines are fine.
- Disk: about 500 MB for the images, plus the database (low megabytes for one
  user) and whatever backups you keep.
- Network: nothing inbound is required with Tailscale. Without it, ports 80
  and 443 for a reverse proxy.

## 2. Start

Make a directory, put `docker/compose.yaml` and
`docker/env.example` in it, rename the second to `.env`, and set
`POSTGRES_PASSWORD`:

```sh
mkdir karotto && cd karotto
curl -fsSLO https://raw.githubusercontent.com/maxkueng/karotto/master/docker/compose.yaml
curl -fsSL https://raw.githubusercontent.com/maxkueng/karotto/master/docker/env.example -o .env
$EDITOR .env
docker compose up -d --wait
docker compose exec app karotto-admin user create max --timezone Europe/Zurich
curl http://127.0.0.1:3000/api/v1/health
```

Migrations run when the app container starts.

## 3. Configuration

`.env` next to `compose.yaml`:

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | required | Database password; only the two containers use it |
| `KAROTTO_VERSION` | `latest` | Image tag, see [Tags](#5-tags) |
| `KAROTTO_BIND`, `KAROTTO_PORT` | `0.0.0.0`, `3000` | Address and port on the host. Published ports bypass host firewalls, so use `127.0.0.1` when a proxy on the same machine is the way in |
| `SECURE_COOKIES` | `false` | Session cookie `Secure` flag. Set `true` behind anything that terminates HTTPS; with `true` over plain HTTP, browsers drop the cookie and login fails |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-*`; `true` behind Tailscale or a reverse proxy |
| `SESSION_TTL_DAYS` | `365` | Web session lifetime |
| `LOG_LEVEL` | `info` | pino level |

Edit, then `docker compose up -d` to apply.

## 4. Operating it

| Task | Command |
|---|---|
| Logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Create a user / API token | `docker compose exec app karotto-admin user create <name>`, `… token create <name> --name scripts` |
| Change a password | `docker compose exec app karotto-admin user password <name>` |
| API client | `docker compose exec app karotto login --url http://localhost:3000 -u <name>`, then `… karotto tasks list` |

### Backups

The database is the only state. A `pg_dump` from the db container is a
consistent snapshot; a copy of the Docker volume while Postgres runs is not.
When and where to keep dumps is up to you; a cron job or systemd timer running
the first command below, plus a copy off the machine, is enough.

```sh
docker compose exec -T db pg_dump -U karotto --no-owner --no-privileges karotto | gzip > karotto-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
```

Restore, replacing the current database:

```sh
docker compose stop app
docker compose exec -T db psql -U karotto -d postgres -c 'drop database karotto' -c 'create database karotto owner karotto'
zcat karotto-<stamp>.sql.gz | docker compose exec -T db psql -U karotto -d karotto -v ON_ERROR_STOP=1 --quiet
docker compose start app
```

### Updates

```sh
docker compose pull && docker compose up -d --wait
```

Migrations run on start and only go forward, so take a dump right before you
pull. Going back to an older image means restoring that dump. For the same
reason, an unattended updater (Watchtower and friends) can migrate the
database long after the last backup.

## 5. Tags

| Tag | What |
|---|---|
| `latest` | Newest release |
| `0.3.0`, `0.3` | A specific release, or its newest patch |
| `edge` | Every push to `master`. Fine for trying things, not for keeping |

Pin `KAROTTO_VERSION` if you want every version change to be an explicit
edit, and an obvious rollback target.

## 6. Access

The app speaks plain HTTP. It does not terminate TLS and it is not meant to
face the internet directly. Put something in front of it; the examples assume
`KAROTTO_BIND=127.0.0.1`, `SECURE_COOKIES=true` and `TRUST_PROXY=true`.

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
   sudo tailscale serve --service=svc:karotto --https=443 127.0.0.1:3000
   ```

   If the host does not appear under the service within a minute, the
   advertisement was sent before the tag applied and got dropped; re-send it:

   ```sh
   sudo tailscale serve --service=svc:karotto reset
   sudo tailscale serve --service=svc:karotto --https=443 127.0.0.1:3000
   ```

`tailscale serve status` confirms the mapping; it survives reboots. Requires
Tailscale 1.86 or newer on the host.

#### With plain `tailscale serve` (no admin work)

```sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up                    # prints a login URL, approve it once
sudo tailscale serve --bg https:443 http://127.0.0.1:3000
```

This uses the machine's own name, `https://<machine>.<tailnet>.ts.net`, and
claims the machine's tailnet port 443; a second app needs another port
(`https:8443`). Certificates need MagicDNS and HTTPS enabled once for the
tailnet, which the command tells you about if they are not.

### A reverse proxy with TLS

For a public hostname, put Caddy (or nginx, Traefik, ...) in front and open
ports 80 and 443. Caddy fetches its own certificates:

```
karotto.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

### Plain HTTP on the LAN

For testing, or a network you trust, keep the defaults
(`KAROTTO_BIND=0.0.0.0`, `SECURE_COOKIES=false`) and use
`http://<machine>:3000`. Do not do this on a network you do not control.

## 7. Clients

Every client takes the URL you chose above.

- **Browser:** open the URL and log in.
- **Android app:** enter the URL on the login screen. It creates its own
  long-lived token on login and never stores the password. With Tailscale,
  install the Tailscale app on the phone and join the same tailnet.
- **CLI:** `karotto login --url <url> -u <username>` inside the app container,
  or on any machine with Node 24 after downloading the standalone `karotto`
  from a release (see the README's command-line client section).
- **Home Assistant:** add the Karotto integration with the URL and your
  credentials. See `docs/HOME_ASSISTANT.md`; on Home Assistant OS with
  Tailscale the Supervisor DNS needs to resolve `*.ts.net` names.

## Build it yourself

```sh
docker build -t karotto .
```

The Dockerfile builds the JavaScript once on the host's architecture and
installs runtime dependencies on the target's, so cross-building is cheap:
`docker buildx build --platform linux/arm64 .` works on an x86 machine.
