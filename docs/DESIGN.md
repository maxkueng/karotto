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
  quick-add with multi-line input, task aliases for the API.
- Custom day start, the "Welcome back" (yesterdailies) modal, day rollover
  (cron) with the same value math.
- Reminders stored on tasks (no delivery; a future mobile app consumes them).

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
| Auth | argon2id passwords, DB-backed session cookie, hashed named API tokens |
| Deploy | single image: Fastify serves `/api` and the built web app |

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
  `date_format`, `active_filter`, `completed_todo_retention_days`), `last_cron`,
  `cron_lock_at`
- `sessions`: hashed token, user, expiry, last seen
- `api_tokens`: hashed token, prefix for display, name, last used, optional expiry
- `tags`: name, position
- `tasks`: single table with a `type` column and nullable per-type columns;
  `checklist` and `reminders` as jsonb arrays; `position` integer per user and
  type
- `task_tags`: join table, cascades on tag delete
- `task_history`: one row per entry; habits get one row per CDS day updated in
  place, dailies one row per check and per rollover

Task order is an integer `position` per type, renumbered on move with a single
`UPDATE ... FROM unnest(...) WITH ORDINALITY`. New tasks go to the top.
Completed to-dos are not part of the order.

## API

All under `/api/v1`, JSON, zod-validated, OpenAPI at `/api/v1/openapi.json`.
Auth is either the session cookie or `Authorization: Bearer krt_...`.

Errors: `{ error: { code, message, details? } }` with the HTTP status. Codes are
stable strings (`validation`, `not_found`, `unauthorized`, `conflict`, ...).

Endpoints (see `packages/server/src/routes/`):

- auth: `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`
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

`:id` accepts a task UUID or its alias. Reads never write (Habitica's task list
endpoint repairs and persists order on GET).

## Users

No self-registration. `karotto-admin user create <username>` and
`karotto-admin token create <username> --name <label>` on the server. Multi-user is
first class in the schema; every query is scoped by `user_id`.

## Not in v1

- Webhooks (schema documented in the analysis; add when needed)
- Reminder delivery and push devices
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
- Global CSS (`index.css`) holds only the theme tokens, `@layer base` resets
  and `@layer components` rules for markdown output and drag ghosts, so that
  Tailwind utilities always win.
