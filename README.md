# karotto

Habitica's task UX without the game. Habits, dailies and to-dos with the same
value/colour mechanics, streaks, counters, schedules, checklists, tags and day
rollover, but no HP, XP, gold, items, avatars or popups.

See `docs/DESIGN.md` for what was kept, what was dropped and where karotto
deliberately deviates from Habitica. `docs/habitica-analysis/` holds the source
analysis the implementation was derived from.

## Layout

| Package | What |
|---|---|
| `packages/core` | Shared zod schemas and pure domain logic: scheduling, scoring, rollover, colours |
| `packages/server` | Fastify API, Drizzle/Postgres, auth, CLI |
| `packages/web` | Vite + SolidJS + Tailwind client |
| `packages/android` | Native Kotlin + Jetpack Compose app, UI modelled on the Habitica Android client |

## Development

Requirements: Node 24, Docker (for Postgres).

```sh
npm install
docker compose up -d db
cp .env.example .env            # defaults work with the compose database
npm run cli -w @karotto/server -- migrate
npm run cli -w @karotto/server -- user create max --timezone Europe/Zurich
npm run dev                     # API on :3210, web on :5173 (proxies /api)
```

Checks:

```sh
npm run typecheck
npm run lint
npm test
```

## Android app

`packages/android` is a standalone Gradle project (not an npm workspace). It
talks to the same API with a long-lived token created through
`POST /api/v1/auth/token` from the login screen, caches tasks in Room, scores
optimistically with an offline queue, computes daily due-ness locally and
delivers reminders as exact alarms.

Requirements: JDK 21, Android SDK with platform 37. The Gradle wrapper fetches
everything else.

```sh
cd packages/android
./gradlew installDebug          # build and install on the connected device/emulator
./gradlew testDebugUnitTest     # scheduling/scoring/day-context tests
```

Server URL on the login screen:

- Emulator: `http://10.0.2.2:3210` (the host's loopback).
- Phone on the same LAN or Tailscale: start the API with `HOST=0.0.0.0` in
  `.env` and use `http://<machine-ip>:3210`. Cleartext HTTP is allowed by the
  app for that purpose; put the deployed server behind HTTPS.

## API

Everything is under `/api/v1`, described by `/api/v1/openapi.json`. Create a
long-lived token in Settings or with the CLI and send it as a bearer token:

```sh
npm run cli -w @karotto/server -- token create max --name scripts

curl -H "Authorization: Bearer krt_..." http://localhost:3210/api/v1/tasks
curl -X POST -H "Authorization: Bearer krt_..." -H 'content-type: application/json' \
  -d '{"type":"todo","text":"Buy carrots","alias":"carrots"}' http://localhost:3210/api/v1/tasks
curl -X POST -H "Authorization: Bearer krt_..." http://localhost:3210/api/v1/tasks/carrots/score/up
```

Task ids and aliases are interchangeable in URLs. Day rollover is triggered by
clients (`POST /api/v1/cron`), exactly like Habitica; scripts that score today's
tasks before the web app has been opened should call it first. `GET
/api/v1/cron/status` tells you whether a rollover is pending and which dailies
were due yesterday.

## CLI

```
karotto migrate
karotto user create <username> [--password-stdin] [--timezone <IANA>]
karotto user list | password <username> | delete <username>
karotto token create <username> --name <label> [--expires <iso>]
karotto token list <username> | revoke <username> <id>
```

In development run it through `npm run cli -w @karotto/server -- <args>`; in
the container it is `node packages/server/dist/cli.js <args>`.

## Production

```sh
docker build -t karotto .
docker run -e DATABASE_URL=postgres://... -p 3210:3000 karotto
```

The image serves the API and the web app from one process. Migrations run on
boot (`AUTO_MIGRATE=true`). Set `TRUST_PROXY=true` behind a reverse proxy and
leave `SECURE_COOKIES` at its production default (on) so the session cookie is
only sent over HTTPS.

Environment variables: see `.env.example`.
