# karotto design

karotto is Habitica's task UX without the game. This document records what was
kept, what was dropped, and where karotto deliberately deviates from Habitica's
source. The raw source analysis lives in `docs/habitica-analysis/`.

## Scope

Kept from Habitica:

- Three task types: habits, dailies, to-dos. Separate columns, same card look.
- Task value ("redness") and the seven colour bands driven by it.
- Daily streaks, habit counters with daily/weekly/monthly reset.
- Daily schedules: every X days, weekdays every X weeks, day-of-month or
  Nth-weekday every X months, every X years, with a start date.
- Checklists, tags with AND filtering, search, per-column filters
  (All/Weak/Strong, All/Due/Not Due, Active/Scheduled/Complete), drag ordering,
  quick-add with multi-line input, task aliases for the API. Filters are
  per client (browser storage, Android DataStore), not synced: a wall
  dashboard and a phone should not fight over them.
- Custom day start, the "Welcome back" (yesterdailies) modal, day rollover
  (cron) with the same value math.
- Reminders stored on tasks. The Android app delivers them as exact alarms;
  the web app does not deliver.

Dropped: HP, XP, MP, gold, levels, classes, attributes, items, drops, pets,
mounts, avatar, quests, party, guilds, challenges, group tasks, shops, rewards
column, Bailey, achievements, streak bonuses, buffs, sleep/inn, subscriptions.

Also dropped, deliberately: **difficulty**. In Habitica `priority` only scales
XP, gold and HP damage; it has zero effect on task value. Without stats it is a
label with no consequence, so it is not in the schema. Adding it back later is
one column and one select.

## Stack

| Layer | Choice |
|---|---|
| Domain logic + API schemas | `@karotto/core`, pure TypeScript, zod 4, luxon |
| API | `@karotto/server`, Fastify 5 + `fastify-type-provider-zod`, Drizzle, postgres.js |
| Database | PostgreSQL 17 (PGlite in tests) |
| Web | `@karotto/web`, Vite + SolidJS + Tailwind 4 with the `twc` helper |
| Icons | lucide-solid |
| Android | `packages/android`, Kotlin + Jetpack Compose, Room cache, OkHttp, standalone Gradle project |
| CLI / MCP | `@karotto/cli`, yargs; `karotto mcp` serves the same operations over the Model Context Protocol |
| Home Assistant | `custom_components/karotto`, Python, config flow, todo + sensor platforms |
| Themes | `core/src/theme`: OKLCH palette engine; generates CSS variables for the web and Kotlin palettes for Android |
| Auth | argon2id passwords, DB-backed session cookie, hashed named API tokens |
| Live updates | Server-Sent Events from an in-process hub; every mutation publishes to the user's streams |
| Deploy | `deploy/install.sh`: systemd service, local Postgres, nightly backup timer; a `Dockerfile` is the alternative |

The scoring, schedule and rollover math live in `core` so the browser computes
exactly what the server will persist (optimistic UI without drift).

## Time model

Habitica stores a UTC offset in minutes with an inverted sign and patches it
from a request header, then runs a "safe/unsafe direction" heuristic at cron to
survive DST. karotto stores an IANA zone (`preferences.timezone`) and lets luxon
do DST.

Definitions used everywhere (`core/src/time.ts`):

- **CDS day** of an instant: the calendar date, in the user's zone, of the
  user's day containing that instant. If the local hour is before `dayStart`
  the instant belongs to the previous calendar date.
- `daysBetween(a, b)` = difference in CDS-day numbers, never a duration.
- Daily `startDate` and to-do `dueDate` are calendar dates (`YYYY-MM-DD`), not
  instants. Habitica stores them as Dates with a meaningless time portion and
  has a heuristic to "normalise" them; karotto simply does not store a time.
- `shouldDo(day, daily)` is pure calendar arithmetic on ISO dates. "Is it due
  now" is `shouldDo(cdsDay(now), daily)`.

Consequences: the client-side yesterdailies check and the server-side rollover
use the same definition of "yesterday" (`cdsDay(now) - 1`), which fixes the
midnight-to-dayStart mismatch in Habitica.

## Scheduling (`shouldDo`)

Same rules as Habitica's `shouldDo` with moment-recur, re-derived on civil
dates. `d` is the CDS day, `s` the start date, `n = everyX`:

- never due before `s`; `everyX` outside `1..9999` is never due
- daily: `(d - s) % n == 0` in days
- weekly: weekday of `d` enabled in `repeat` and `floor((d - s) / 7) % n == 0`
  (7-day blocks from the start date, not calendar weeks; Habitica does the same)
- monthly: `monthsBetween(s, d) % n == 0` and either
  - `weeksOfMonth` non-empty: weekday enabled and `floor((dayOfMonth - 1) / 7)`
    is in `weeksOfMonth` (0-indexed occurrence; `4` = 5th, which only some
    months have), or
  - `daysOfMonth` non-empty: `dayOfMonth` in the list, or `d` is the last day of
    its month and some listed day is beyond it (so `[31]` is due on Feb 28)
  - neither: never due. Habitica treats this as "every day"; the API rejects it.
- yearly: same month and day as `s`, `(year(d) - year(s)) % n == 0`. A Feb 29
  start only recurs in leap years, as in Habitica.

`nextDueDates(fromDay, daily, count)` returns the next `count` due days after
`fromDay` by generating candidates per frequency and verifying each with
`shouldDo`, so both can never disagree (Habitica's weekly generator and matcher
disagree when `everyX > 1` and the start date is not a Sunday).

## Value and scoring

Verbatim from Habitica (`docs/habitica-analysis/01-...md` §2):

- forward delta `±0.9747^clamp(value, -47.27, 21.27)`
- interactive down (habit −, uncheck) uses the reverse solver: the exact
  inverse of a forward up-step, so check then uncheck is a round trip
- daily miss at rollover: forward down scaled by `1 - completedChecklistFraction`
- to-do check: forward up scaled by `1 + completedChecklistItems`; uncheck is
  the reverse delta with the same multiplier
- to-do rollover: one forward down per rollover, checklist ignored
- one-sided habits halve toward 0 at rollover, snapping to 0 under 0.1
- colour bands: `< -20 worst, < -10 worse, < -1 bad, < 1 neutral, < 5 good,
  < 10 better, else best`

Deviations:

- streak never goes below 0 (Habitica lets repeated unchecks make it negative)
- unchecking a daily removes the history entry that the check created, not
  blindly the last entry
- scoring a disabled habit direction is rejected by the API (Habitica only hides
  the button)
- the score response returns the updated task and the applied delta

## Rollover (cron)

Same policy as Habitica, `multiDaysCountAsOneDay = true`: however long the user
was away, each daily is judged once, on whether it was due *yesterday* (the CDS
day before the current one).

For each task, in a transaction:

- to-do, not completed: one forward down step
- daily, completed: nothing; then `completed = false`, checklist reset
- daily, not completed and due yesterday: forward down scaled by checklist
  fraction, `streak = 0`, history entry `{completed: false, isDue: true}`,
  checklist reset
- daily, not completed and not due yesterday: history entry
  `{completed: false, isDue: false}`, checklist kept
- habit: counters reset when the period rolled (daily: always; weekly: ISO week
  of `cdsDay(now)` differs from that of `cdsDay(now) - daysMissed`; monthly:
  month differs), one-sided value decay
- completed to-dos older than the retention window are deleted

The trigger is the same as Habitica's: rollover runs when a client asks
(`POST /api/v1/cron`), never on its own, because the "Welcome back" modal has
to let the user tick what they did yesterday before penalties apply. `GET
/api/v1/user` reports `needsCron`; `GET /api/v1/cron/status` additionally lists
the yesterdailies candidates so API clients can run the same flow. Automation
that scores today's tasks early in the day should call `POST /api/v1/cron`
first, exactly as with Habitica.

Locking: the rollover runs inside one transaction that first takes
`SELECT ... FOR UPDATE NOWAIT` on the user row, so the lock lives exactly as
long as the transaction. A concurrent rollover gets `409 cron_running`.

## Data model

Postgres, UUID primary keys, `timestamptz` for instants, `date` for calendar
dates. Tables:

- `users`: username, password hash, preferences (`day_start`, `timezone`,
  `date_format`, `completed_todo_retention_days`), `last_cron`. Filter state
  is not stored server-side.
- `sessions`: hashed token, user, expiry, last seen
- `api_tokens`: hashed token, prefix for display, name, last used, optional expiry
- `tags`: name, position; unique per user, case-insensitively
  (`409 tag_exists`)
- `tasks`: single table with a `type` column and nullable per-type columns;
  `checklist` and `reminders` as jsonb arrays; `position` integer per user and
  type; `alias` unique per user
- `task_tags`: join table, cascades on tag delete
- `task_history`: one row per entry; habits get one row per CDS day updated in
  place, dailies one row per check and per rollover

Task order is an integer `position` per type, renumbered on move with a single
`UPDATE ... FROM unnest(...) WITH ORDINALITY`. New tasks go to the top.
Completed to-dos are not part of the order.

## API

All under `/api/v1`, JSON, zod-validated. OpenAPI at `/api/v1/openapi.json`,
Swagger UI at `/api/v1/docs`, both generated from the zod schemas with the
route summaries. Auth is either the session cookie or
`Authorization: Bearer krt_...`.

Errors: `{ error: { code, message, details? } }` with the HTTP status. Codes are
stable strings (`validation`, `not_found`, `unauthorized`, `already_completed`,
`not_completed`, `tag_exists`, `cron_running`, ...). Empty request bodies are
accepted under any content type so automation tools that POST without a
payload work.

Endpoints (see `packages/server/src/routes/`):

- auth: `POST /auth/login` (session cookie), `POST /auth/token` (exchange
  credentials for a named long-lived token; used by the Android app, the CLI
  and the Home Assistant integration), `POST /auth/logout`, `GET /auth/session`
- user: `GET /user`, `PATCH /user/preferences`, `PUT /user/password`
- tokens: `GET /user/tokens`, `POST /user/tokens`, `DELETE /user/tokens/:id`
- tasks: `GET /tasks?type=`, `POST /tasks`, `GET|PATCH|DELETE /tasks/:id`,
  `POST /tasks/:id/score/:direction`, `POST /tasks/score` (bulk),
  `POST /tasks/:id/move/:position`, `PUT /tasks/order`,
  checklist `POST /tasks/:id/checklist`, `PATCH|DELETE /tasks/:id/checklist/:itemId`,
  `POST /tasks/:id/checklist/:itemId/score`,
  `POST|DELETE /tasks/:id/tags/:tagId`, `POST /tasks/clear-completed`,
  `GET /tasks/:id/history`
- tags: `GET|POST /tags`, `PATCH|DELETE /tags/:id`, `PUT /tags/order`
- cron: `GET /cron/status`, `POST /cron`
- events: `GET /events` (Server-Sent Events, see below)

`:id` accepts a task UUID or its alias. Reads never write (Habitica's task list
endpoint repairs and persists order on GET).

## Live updates

Every mutating route publishes a change event to an in-process `EventHub`
keyed by user: `task.upserted`, `task.deleted`, `tasks.reordered`,
`tasks.invalidated` (after a rollover), `tags.changed`, `user.updated`.
`GET /events` streams them as SSE with a `: ping` comment every 25 seconds.
A client sends an `X-Client-Id` header on its requests and the same value is
echoed as `origin` on each event, so it can skip changes it caused itself.
The hub is in-process, so one server instance; there is no fan-out bus.

Consumers: the web app subscribes while the tab is open, the Android app while
in the foreground, the Home Assistant integration always, with backoff
reconnects and a full refetch after each reconnect.

## Themes

Habitica's palette is not karotto's identity. The default theme is Carrot;
Habitica's colours ship as the optional "Classic" theme. Tokyo Night,
Synthwave '84, Catppuccin, Nord, Gruvbox and Solarized are the others.

A theme is a `ThemeSpec` in `core/src/theme/themes.ts` with a light and/or
dark `ThemeVariant`: ink, page, surface, brand and seven hue anchors.
`buildTokens` derives the full token set from those anchors in OKLCH: brand
and neutral ramps, per-hue ramps for the task value bands, tints, and the
surface/well/popover/nav roles. Contrast decisions live in the engine, not in
each theme, so a new theme is a dozen colours.

Generated outputs are committed: `packages/web/src/theme.generated.css`
(Tailwind variables, `npm run theme:css -w @karotto/web`) and
`GeneratedThemes.kt` for Android (`npm run themes:android -w @karotto/core`).
The web app switches themes at runtime by setting the CSS variables; theme and
colour mode are per client (browser storage, Android settings), like filters.

## Clients

- **Web** (`packages/web`): the primary UI, three columns, per-client filters,
  undo snackbar after completing a task, themes.
- **Android** (`packages/android`): a native client modelled on Habitica's
  Android app. Logs in with `POST /auth/token`, caches tasks in Room, queues
  scores while offline (`pending_scores`), computes due-ness locally with the
  same schedule rules, delivers reminders as exact alarms, reorders by drag.
- **CLI** (`packages/cli`, binary `karotto`): tasks, scoring, tags, cron and
  raw API calls with `--json` output for scripts; task references by alias,
  id or unique id prefix. `karotto mcp` exposes the same operations as MCP
  tools. `skills/karotto/SKILL.md` teaches agents the CLI.
- **Home Assistant** (`custom_components/karotto`): to-do list entities for
  to-dos and today's dailies, count sensors, a rollover-pending binary sensor,
  and `karotto.score` / `run_rollover` / `add_task` actions. Live over SSE.
  See `docs/HOME_ASSISTANT.md`.
- **Server admin** (`karotto-admin`): users, tokens, migrations; runs on the
  server with database access, never over the API.

## Users

No self-registration. `karotto-admin user create <username>` and
`karotto-admin token create <username> --name <label>` on the server. Multi-user is
first class in the schema; every query is scoped by `user_id`.

## Not in v1

- Outbound webhooks (the SSE stream covers live consumers; schema for
  webhooks is documented in the analysis, add when needed)
- Reminder delivery on the web (Android delivers them; there is no push
  service)
- Task history charts (the Habitica web client shows none either)
- Data export

## Web client conventions

- No `class` attributes in components. Every styled element is a named `twc`
  component (`packages/web/src/styles/twc.tsx`, cva + tailwind-merge) with one
  class per line; conditional styling goes through variants.
- One `Button` (`components/ui/Button.tsx`) with `layout` and `size` variants
  covers every clickable control, including task controls, tabs, menu items,
  links and calendar cells. It renders as a `<button>` or, with
  `renderAs="link"`, as a router link.
- Shared atoms live in `components/ui/`: `Heading`, `Text`, `Badge`, `Caret`,
  `Row`, `Stack`, `Spacer`, `Card`, `FloatingPanel`, `Input`/`Select`/`Label`,
  `Checkbox`, `Radio`, `Modal`, `Menu`, `Tooltip`, `DatePicker`, `ToggleGroup`.
  Feature components compose these; component-specific layout pieces sit in a
  sibling `*.styles.ts` file.
- Global CSS (`index.css`) holds only fonts, shadows, `@layer base` resets and
  `@layer components` rules for markdown output and drag ghosts, so that
  Tailwind utilities always win. Colour tokens come from the generated
  `theme.generated.css`; never hand-edit it, change `core/src/theme` and
  regenerate.
