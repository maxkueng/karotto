# Deploying karotto

One small VM, Postgres on the same box, the app as a systemd service, and
Tailscale for access so nothing but SSH is exposed to the internet. The whole
thing is `deploy/install.sh`; everything below explains what it does and the
few manual steps around it.

## 1. The server

Any Debian or Ubuntu host works. On DigitalOcean: Create → Droplets →
Ubuntu 24.04 LTS, the smallest Regular plan (1 vCPU, 1 GB) is plenty, SSH
key authentication, and enable the weekly droplet backups if you like belt
and braces. Note the IP; you only ever need it for SSH.

```sh
git clone https://github.com/<you>/karotto.git ~/karotto
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
- installs `karotto.service`, a nightly `karotto-backup.timer`, and the
  `karotto` CLI wrapper in `/usr/local/bin`;
- applies migrations and starts the service.

Then create your account:

```sh
sudo karotto user create max --timezone Europe/Zurich
sudo journalctl -u karotto -f
```

## 2. Tailscale

The app listens on `127.0.0.1:3210` only. Tailscale puts it on your tailnet
with a real HTTPS certificate, no open ports and nothing to configure in a
web dashboard:

```sh
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up                         # prints a login URL, approve it once
tailscale serve --bg https:443 http://127.0.0.1:3210
```

`tailscale serve` terminates TLS with a certificate for the machine's
MagicDNS name and forwards to the app. The URL is
`https://<droplet-name>.<tailnet>.ts.net`; `tailscale status` shows the
name. Certificates need MagicDNS and HTTPS enabled once for the tailnet,
which the command tells you about if they are not.

That URL works from every device on the tailnet, phone included. Use it on
the Android login screen and in the browser. `TRUST_PROXY=true` in
`/etc/karotto/env` makes the app read the client address from the
`X-Forwarded-For` header that `tailscale serve` sets, and `NODE_ENV=production`
keeps the session cookie HTTPS-only, which is right because the browser talks
HTTPS to Tailscale.

If you ever want the app reachable without Tailscale, put Caddy in front
instead and open ports 80 and 443; it fetches its own certificates:

```sh
apt install caddy
cat >/etc/caddy/Caddyfile <<'CADDY'
karotto.example.com {
    reverse_proxy 127.0.0.1:3210
}
CADDY
systemctl reload caddy
```

Plain HTTP on a LAN also works for testing: set `SECURE_COOKIES=false` or the
browser will drop the session cookie.

## 3. Day to day

| Task | Command |
|---|---|
| Update to the latest version | `cd ~/karotto && git pull && sudo deploy/install.sh` |
| Logs | `journalctl -u karotto -f` |
| Restart | `systemctl restart karotto` |
| Create a user / API token | `karotto user create <name>`, `karotto token create <name> --name scripts` |
| Change a password | `karotto user password <name>` |
| Manual backup | `systemctl start karotto-backup` |
| Restore a backup | `zcat /var/backups/karotto/karotto-<stamp>.sql.gz \| sudo -u postgres psql karotto` |

Backups land in `/var/backups/karotto` nightly at 03:30, last 30 kept. Copy
them off the box now and then; DigitalOcean's droplet backups cover the
disk, not a consistent database snapshot.

## 4. Configuration

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

## 5. Phone

Install Tailscale on the phone, join the same tailnet, and point the Android
app at `https://<droplet-name>.<tailnet>.ts.net`. It creates its own
long-lived token on login and never stores the password.

## Docker instead

The repository also ships a `Dockerfile` that builds the same thing into one
image (API plus static web app) and a `docker-compose.yml` for Postgres. Use
it if you already run everything in containers; the systemd path above is
otherwise simpler to keep updated and back up.
