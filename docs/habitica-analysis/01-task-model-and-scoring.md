# Habitica task data model and scoring (de-gamified spec)

Source root: `website/` in the Habitica checkout. All line numbers refer to that checkout.
Files that matter:

- `website/server/models/task.js` (Mongoose schema; the source of truth)
- `website/common/script/libs/taskDefaults.js` (client-side defaults; mirrors the schema)
- `website/common/script/ops/scoreTask.js` (value/streak/counter/history mutation)
- `website/server/libs/cron.js` (day rollover: todo decay, missed dailies, counter reset, history pruning)
- `website/common/script/cron.js` (`shouldDo`, `daysSince`, `startOfDay` — schedule maths)
- `website/server/libs/preening.js` (history compression)
- `website/server/libs/tasks/index.js`, `website/server/libs/tasks/utils.js` (create/get/score/move plumbing)
- `website/server/controllers/api-v3/tasks.js`, `website/server/controllers/api-v3/tags.js` (HTTP semantics)
- `website/server/models/tag.js`, `website/server/models/user/schema.js` (tags, tasksOrder, preferences)
- `website/client/src/store/getters/tasks.js`, `website/client/src/assets/scss/task.scss`, `website/client/src/assets/scss/colors.scss` (value -> colour)

Everything below is what the code does, not what the docs or comments claim. Where a comment lies I say so.

---

## 1. Task schema

### 1.1 Mongoose plumbing that affects every task

`website/server/models/task.js:11-18` — discriminator key is `type`; sub-schemas use `typeKey: '$type'`, `_id: false`, `minimize: false` (empty objects are returned, not stripped).

`website/server/libs/baseModel.js:10-31` — the `baseModel` plugin adds:

| field | type | default | validation |
|---|---|---|---|
| `_id` | String | `uuid()` (v4) | must be a UUID |
| `createdAt` | Date | `Date.now` | — |
| `updatedAt` | Date | `Date.now` | — |

`baseModel.js:33-37` — `pre('save')`: `if (!this.isNew) this.updatedAt = Date.now()`. `pre('updateOne')`/`pre('updateMany')` set `updatedAt` too.
`baseModel.js:64-75` — `toJSON` always adds `id = _id` and strips `__v`.

`task.js:159-188` — plugin options for tasks:

- `noSet` (fields the API silently strips from any client payload, `Task.sanitize()`): `createdAt, updatedAt, challenge, userId, completed, history, dateCompleted, _legacyId, group, isDue, nextDue`.
- `sanitizeTransform` (`task.js:161-185`):
  - non-reward: `delete taskObj.value` — **task.value is never client-settable** for habit/daily/todo.
  - `priority`: `Number.parseFloat(priority).toFixed(1)` (yields a string like `"1.5"`; Mongoose casts back to Number; a value such as 1.25 becomes `"1.3"` and then fails enum validation).
  - `attribute === null` -> `'str'`.
- `timestamps: true`, `private: []`.

Constant: `tasksTypes = ['habit', 'daily', 'todo', 'reward']` (`task.js:20`). Reward is ignored in this spec.

### 1.2 Base fields (all types) — `task.js:60-157`

| field | type | default | constraints / notes |
|---|---|---|---|
| `type` | String | `'habit'` | enum `['habit','daily','todo','reward']`, required. Cannot be changed after creation (`ops/updateTask.js:23` omits `type` from the merge). |
| `text` | String | — | **required**. No length limit anywhere (server or client). Client only checks `text.length > 0` (`taskModal.vue:1424`). |
| `notes` | String | `''` | no limit |
| `alias` | String | undefined | `match: /^[a-zA-Z0-9-_]+$/`; must not be a UUID; unique per `userId` (async validator `task.js:80-89`); only allowed when `userId` set. See §9. |
| `tags` | [String] | `[]` | each element must be a UUID (`task.js:92-95`); references `user.tags[].id`. |
| `value` | Number | `0` | required. The "redness". Never settable via API for non-rewards (see 1.1). No schema clamp; only the delta computation clamps (§2.1). |
| `priority` | Number | `1` | required; validator `[0.1, 1, 1.5, 2].indexOf(val) !== -1` (`task.js:112-115`). UI names: 0.1 Trivial, 1 Easy, 1.5 Medium, 2 Hard. **Not used anywhere in the value computation** — only in exp/gp/hp (stripped). Keep as a display attribute or drop. |
| `attribute` | String | `'str'` | enum `['str','con','int','per']`. Only used for stat auto-allocation. **Drop.** |
| `userId` | String | — | UUID, ref User. Unset = challenge/group master task. |
| `challenge` | object | `{}` | `{shortName, id, taskId, broken (enum CHALLENGE_DELETED/TASK_DELETED/UNSUBSCRIBED/CHALLENGE_CLOSED/CHALLENGE_TASK_NOT_FOUND), winner}` — **drop**. |
| `group` | object | `{}` | `{id, assignedDate, assigningUsername, assignedUsers[], assignedUsersDetail (Mixed), taskId, managerNotes, completedBy{userId,date}}` — **drop**. |
| `reminders` | [reminderSchema] | `[]` | see 1.3 |
| `byHabitica` | Boolean | `false` | "created by Habitica" (onboarding tasks). Client paints such tasks purple regardless of value (`getters/tasks.js:24`). |
| `_id`, `createdAt`, `updatedAt` | | | from baseModel (1.1) |

### 1.3 Reminder sub-schema — `task.js:38-55`

| field | type | default | constraints |
|---|---|---|---|
| `id` | String | `uuid()` | UUID, required; not client-settable (`noSet: ['_id','id']`) — `Task.sanitizeReminder()` deletes `id` (`task.js:281-284`) |
| `startDate` | Date | — | optional |
| `time` | Date | — | required |

`ops/updateTask.js:8-11`: if `body.reminders` is present the whole array is **replaced**.

### 1.4 Habit — `task.js:369-376`

Adds `history: Array` (`habitDailySchema`, `task.js:351`) plus:

| field | type | default | constraints |
|---|---|---|---|
| `up` | Boolean | `true` | enables the "+" button |
| `down` | Boolean | `true` | enables the "−" button |
| `counterUp` | Number | `0` | client-editable (`taskModal.vue:623`) |
| `counterDown` | Number | `0` | client-editable (`taskModal.vue:647`) |
| `frequency` | String | `'daily'` | enum `['daily','weekly','monthly']` — this is the **counter reset period**, not a schedule |
| `history` | Array | `[]` | untyped for performance (`task.js:346-349`); entry shape in §4 |

**Server does not refuse scoring a disabled direction.** `scoreTask.js` never reads `task.up`/`task.down`. Only the client hides the button. Reimplementation should reject it explicitly.

### 1.5 Daily — `task.js:378-413`

Adds `history: Array`, plus the daily/todo shared block (`dailyTodoSchema`, `task.js:354-367`):

| field | type | default | constraints |
|---|---|---|---|
| `completed` | Boolean | `false` | not client-settable (noSet) — only via scoring |
| `collapseChecklist` | Boolean | `false` | UI toggle; persisted |
| `checklist` | [item] | `[]` | item schema in §5 |

Daily-specific:

| field | type | default | constraints |
|---|---|---|---|
| `frequency` | String | `'weekly'` | enum `['daily','weekly','monthly','yearly']` |
| `everyX` | Number | `1` | `val % 1 === 0 && val >= 0 && val <= 9999` (`task.js:383-386`). `shouldDo` returns false when `everyX < 1` (`common/cron.js:112`). |
| `startDate` | Date | `moment.utc().toDate()` | required. Normalised on create/update (§8.2). |
| `repeat` | `{m,t,w,th,f,s,su: Boolean}` | all `true` | used for `weekly`, and for `monthly` when `weeksOfMonth` is set |
| `streak` | Number | `0` | client-settable via PUT; server does `Math.trunc(streak)` on update (`api-v3/tasks.js` update handler) |
| `daysOfMonth` | [Number] | `[]` | 1-31; used for `monthly` |
| `weeksOfMonth` | [Number] | `[]` | 0-based week-of-month index (`Math.ceil(date/7) - 1`, `taskModal.vue:1617`); used for `monthly` with `repeat` |
| `isDue` | Boolean | — | computed (noSet); recomputed at cron and on create/update/score via `setNextDue` |
| `nextDue` | [String] | — | computed (noSet); up to 6 ISO date strings |
| `yesterDaily` | Boolean | `true` | required. See §8.3 |
| `history` | Array | `[]` | entry shape §4 |

### 1.6 Todo — `task.js:415-419`

Shared daily/todo block (`completed`, `collapseChecklist`, `checklist`) plus:

| field | type | default | notes |
|---|---|---|---|
| `dateCompleted` | Date | — | noSet; set on score up, cleared on score down (§2.5) |
| `date` | Date | — | due date; optional; no server semantics beyond storage and filters (§8.1) |

Todos have **no `history`** on the task. The only todo history is `user.history.todos` (§4.3).

### 1.7 Client defaults (`common/script/libs/taskDefaults.js`)

Mirror of the above, plus two client-only details:

- `text` defaults to the task id if empty (`taskDefaults.js:22`) — irrelevant for the server which requires text.
- Daily `startDate` (`taskDefaults.js:70-92`): `now` in the user's tz; `startOfDay = now.startOf('day')`; if `startOfDay + dayStart hours` is still in the future (i.e. the user's day hasn't rolled yet), `startDate = startOfDay - 1 day`, else `startOfDay`. "If cron will happen today, start the daily yesterday."

### 1.8 Field update semantics (`common/script/ops/updateTask.js`)

- `reminders`, `checklist`, `tags`: replaced wholesale if present in the body.
- Everything else: `lodash.merge(task, omit(body, ['_id','id','type','reminders','checklist','tags']))`.
- `daysOfMonth: []` / `weeksOfMonth: []` in the body explicitly empties the array (merge wouldn't).
- Server side (`api-v3/tasks.js` `updateTask`): after sanitize, for dailies with a `startDate`: normalise (§8.2); if `frequency === 'monthly' && daysOfMonth.length` then `daysOfMonth = [moment(startDate).utcOffset(-timezoneOffset).date()]`; `streak = Math.trunc(streak || 0)`; then `setNextDue`.

---

## 2. Scoring — `website/common/script/ops/scoreTask.js`

Entry point: `scoreTask({ user, task, direction, times = 1, cron = false }, req)` (`scoreTask.js:243`). Returns `delta` (the total change applied to `task.value`, except for the "recalculated" cases noted below). `direction` is `'up' | 'down'`.

HTTP: `POST /tasks/:taskId/score/:direction` (`api-v3/tasks.js:732`), bulk via `scoreTasks(user, [{id, direction}])` (`libs/tasks/index.js:529`). `taskId` may be an alias (§9).

Guards (`libs/tasks/index.js:416-431`): for daily/todo, `up` when `task.completed` -> 401 `sessionOutdated`; `down` when `!task.completed` -> 401 `sessionOutdated`. Habits have no guard.

### 2.1 Constants and the delta curve

```js
// scoreTask.js:18-20
const MAX_TASK_VALUE = 21.27;
const MIN_TASK_VALUE = -47.27;
const CLOSE_ENOUGH = 0.00001;

// scoreTask.js:22-29
function _getTaskValue (taskValue) {
  if (taskValue < MIN_TASK_VALUE) return MIN_TASK_VALUE;
  if (taskValue > MAX_TASK_VALUE) return MAX_TASK_VALUE;
  return taskValue;
}
```

The clamp applies **only to the value fed into the exponent**. `task.value` itself is unbounded; it just moves in steps of at most `0.9747^-47.27 ≈ 3.3579` and at least `0.9747^21.27 ≈ 0.5798`.

Forward delta (`scoreTask.js:33-56`). The comment says "y=.95^x, y>= -5"; the code says otherwise:

```js
function _calculateDelta (task, direction, cron) {
  const currVal = _getTaskValue(task.value);
  let nextDelta = (0.9747 ** currVal) * (direction === 'down' ? -1 : 1);

  if (task.checklist && task.checklist.length > 0) {
    // If the Daily, only dock them a portion based on their checklist completion
    if (direction === 'down' && task.type === 'daily' && cron) {
      nextDelta *= 1 - reduce(task.checklist, (m, i) => m + (i.completed ? 1 : 0), 0) / task.checklist.length;
    }
    // If To Do, point-match the TD per checklist item completed
    if (task.type === 'todo' && !cron) {
      nextDelta *= 1 + reduce(task.checklist, (m, i) => m + (i.completed ? 1 : 0), 0);
    }
  }
  return nextDelta;
}
```

Reverse delta (`scoreTask.js:62-93`), used when **unchecking a daily/todo or pressing "−" on a habit** (any non-cron `down`):

```js
function _calculateReverseDelta (task, direction) {
  const currVal = _getTaskValue(task.value);
  let testVal = currVal + (0.9747 ** currVal) * (direction === 'down' ? -1 : 1);

  while (true) {
    const calc = testVal + (0.9747 ** testVal);
    const diff = currVal - calc;
    if (Math.abs(diff) < CLOSE_ENOUGH) break;
    if (diff > 0) { testVal -= diff; } else { testVal += diff; }
  }

  let nextDelta = testVal - currVal;

  if (task.checklist && task.checklist.length > 0 && task.type === 'todo') {
    nextDelta *= 1 + reduce(task.checklist, (m, i) => m + (i.completed ? 1 : 0), 0);
  }
  return nextDelta;
}
```

What it computes: solve `x + 0.9747^x = currVal` for `x` (the value the task had *before* an up-step landed it on `currVal`), return `x - currVal` (negative). I.e. it is the exact inverse of an up-step, so up-then-uncheck returns to the original value (round-trip error ~4e-7). The `diff > 0` branch is dead code in practice: the first guess always overshoots below, so `diff < 0` on every iteration (verified numerically for values -60..30; 3-6 iterations to converge). A reimplementation may use any root-finder (or Newton) as long as it hits `|diff| < 0.00001`.

Reference vectors (computed from the formulas above):

| value | up delta | cron down delta | reverse (uncheck / habit −) delta |
|---|---|---|---|
| ≤ -47.27 | +3.357913 | -3.357913 | -3.691022 |
| -30 | +2.157104 | -2.157104 | -2.287317 |
| -20 | +1.669478 | -1.669478 | -1.745857 |
| -10 | +1.292083 | -1.292083 | -1.337121 |
| -1 | +1.025957 | -1.025957 | -1.054045 |
| 0 | +1.000000 | -1.000000 | -1.026657 |
| 1 | +0.974700 | -0.974700 | -1.000000 |
| 5 | +0.879741 | -0.879741 | -0.900272 |
| 10 | +0.773944 | -0.773944 | -0.789761 |
| ≥ 21.27 | +0.579810 | -0.579810 | -0.588620 |

Ten consecutive ups from 0: `1.0000 1.9747 2.9254 3.8531 4.7591 5.6443 6.5096 7.3560 8.1842 8.9950`.
Ten habit "−" from 0: `-1.0267 -2.0814 -3.1660 -4.2819 -5.4313 -6.6160 -7.8385 -9.1011 -10.4067 -11.7584`.
Ten cron-downs from 0: `-1.0000 -2.0260 -3.0792 -4.1613 -5.2739 -6.4186 -7.5974 -8.8123 -10.0656 -11.3599`.

### 2.2 The value mutation loop — `_changeTaskValue` (`scoreTask.js:159-202`)

Stripped of stats it is:

```js
function _changeTaskValue (user, task, direction, times, cron) {
  let addToDelta = 0;
  timesLodash(times, () => {
    const nextDelta = !cron && direction === 'down'
      ? _calculateReverseDelta(task, direction)
      : _calculateDelta(task, direction, cron);
    if (task.type !== 'reward') task.value += nextDelta;
    addToDelta += nextDelta;
  });
  return addToDelta;
}
```

- `times` iterations; each iteration recomputes the delta from the *updated* value, so `times: 5` ≠ 5× a single delta (test `test/common/ops/scoreTask.test.js:83-113` asserts this).
- Selection rule: **non-cron `down` -> reverse delta; everything else -> forward delta.**
- `priority` is not involved. `attribute` is not involved.

Removed from this function: crit roll (`crit.crit(user)`, `user._tmp.crit`), `user.stats.training[task.attribute] += nextDelta` (auto-allocation), `user.party.quest.progress.up` (quest damage), `user._tmp.quest.progressDelta`.

### 2.3 Habit (`scoreTask.js:274-304`)

```
delta = _changeTaskValue(user, task, direction, times, cron)
// history (§4.1)
if (_lastHistoryEntryWasToday(lastEntry, user)) _updateLastHistoryEntry(lastEntry, task, direction, times)
else task.history.push({ date: Number(new Date()), value: task.value, scoredUp: direction==='up'?1:0, scoredDown: direction==='down'?1:0 })
_updateCounter(task, direction, times)   // counterUp += times  |  counterDown += times   (scoreTask.js:204-210)
```

- Habit "+" uses the forward delta; habit "−" uses the **reverse** delta (because `!cron && direction === 'down'`). Habits are never scored with `cron: true`.
- A single-direction habit (`up === false` or `down === false`) scores identically; the only difference is the nightly decay in cron (§2.6).
- Note the asymmetry: when a new entry is pushed, `scoredUp/scoredDown` is set to `1`, not `times`; when an existing entry is updated, `times` is added. Reproduce or fix; either is defensible, but know it.

Removed: `_addPoints`/`_subtractPoints` (exp/gp/hp), `_gainMP(max(0.25, 0.0025*maxMP))`.

### 2.4 Daily (`scoreTask.js:305-384`)

**Interactive check (`cron === false`, `direction === 'up'`):**

```
delta = _changeTaskValue(..., 'up', times, false)     // forward delta, checklist ignored
task.streak += 1
task.completed = true
task.history.push({ date: Number(new Date()), value: task.value, isDue: task.isDue, completed: true })
```

**Interactive uncheck (`cron === false`, `direction === 'down'`):**

```
delta = _changeTaskValue(..., 'down', times, false)   // REVERSE delta applied to task.value
delta = _calculateDelta(task, 'down', false)          // scoreTask.js:313 — recomputed for exp/gp only; NOT applied to value; return value differs from the applied change
task.streak -= 1                                      // can go negative; nothing clamps it
task.completed = false
task.history.splice(-1, 1)                            // scoreTask.js:379-381 — removes the LAST history entry, whatever it is
```

The condition guarding the splice is `if (task.history || task.history.length > 0)` — always true when history exists. If the last entry was a cron "missed" entry rather than today's check entry, it is removed anyway. Reimplementation should remove the entry that the check created (e.g. match on `completed === true` and same day) rather than blindly popping.

**Cron (`cron === true`, always `direction === 'down'`, called from `libs/cron.js:269-275` only for due-and-missed dailies):**

```
delta = _changeTaskValue(..., 'down', times, true)    // forward delta × (1 − fractionOfChecklistCompleted)
if (!user.stats.buffs.streaks || task.challenge.id || task.group.id) task.streak = 0
```

Without the "streaks" buff (a class skill; stripped) the streak is **always reset to 0** on a missed due daily. `completed` is not touched here; cron sets `task.completed = false` for every daily afterwards (`libs/cron.js:300`). The cron history entry is pushed by cron, not by scoreTask (§4.2).

Removed: streak achievement (`task.streak % 21 === 0` -> `user.achievements.streak`, notification `STREAK_ACHIEVEMENT`), `_addPoints`, `_subtractPoints`, `_gainMP(max(1, 0.01*maxMP))`, all `task.group.*` branches (`assignedUsersDetail`, `completedBy`).

### 2.5 Todo (`scoreTask.js:385-430`)

**Interactive check (`up`):**

```
task.dateCompleted = new Date()
task.completed = true
delta = _changeTaskValue(..., 'up', times, false)     // forward delta × (1 + number of completed checklist items)
```

**Interactive uncheck (`down`):**

```
task.completed = false
task.dateCompleted = undefined
delta = _changeTaskValue(..., 'down', times, false)   // REVERSE delta × (1 + completed checklist items), applied to value
delta = _calculateDelta(task, 'down', false)          // scoreTask.js:424 — recomputed for stats only
```

Order matters: `completed`/`dateCompleted` flip **before** the value change (opposite of dailies), but nothing in the delta depends on them.

**Cron (`cron === true`, `direction 'down'`, `times: 1`)** — every uncompleted todo, every day (`libs/cron.js:192-207`):

```
delta = _changeTaskValue(..., 'down', 1, true)        // forward delta; checklist multiplier NOT applied because !cron is false
```

So an untouched todo goes 0 → -1 → -2.026 → -3.079 … one step per cron, regardless of due date. (`multiDaysCountAsOneDay = true` at `libs/cron.js:185`; a multi-day absence costs one step.)

Removed: `_addPoints`, `_gainMP` (per-checklist-item MP bonus), group branches.

### 2.6 Cron-side habit processing (`libs/cron.js:69-100`)

```js
function processHabits (user, habits, now, daysMissed) {
  const nowMoment = moment(now).utcOffset(user.getUtcOffset() - user.preferences.dayStart * 60);
  const thatDay = nowMoment.clone().subtract({ days: daysMissed });
  const resetWeekly = nowMoment.isoWeek() !== thatDay.isoWeek();
  const resetMonthly = nowMoment.month() !== thatDay.month();

  habits.forEach(task => {
    let reset = false;
    if (task.frequency === 'daily') reset = true;
    else if (task.frequency === 'weekly' && resetWeekly === true) reset = true;
    else if (task.frequency === 'monthly' && resetMonthly === true) reset = true;
    if (reset === true) { task.counterUp = 0; task.counterDown = 0; }

    // slowly reset value to 0 for "onlies" (Habits with + or - but not both)
    if (task.up === false || task.down === false) {
      task.value = Math.abs(task.value) < 0.1 ? 0 : task.value /= 2;
    }
  });
}
```

- Counter reset: `daily` every cron; `weekly` when the ISO week number of "now" differs from that of `now − daysMissed` days; `monthly` when the month differs. The utcOffset is shifted by `dayStart` hours so week/month boundaries respect Custom Day Start. Note `isoWeek()` (Monday-start) — not the user's locale week. Note the year isn't compared, so a 52-week gap wouldn't reset (irrelevant in practice).
- Single-direction habits decay: value halves every cron, snapping to 0 once `|value| < 0.1`. Two-direction habits never decay.

### 2.7 What `scoreTask` does that is stripped (checklist so nothing is lost)

| stripped thing | where |
|---|---|
| `stats = {gp, hp, exp}` snapshot and `updateStats(user, stats, req)` | `scoreTask.js:248-252, 439` |
| `user._tmp` bookkeeping (`crit`, `streakBonus`, `quest`, `leveledUp`, `drop`) | `:254-262`, throughout |
| reward purchase / "not enough gold" | `:272, 431-436` |
| `_gainMP` (mana) | `:95-107, 283, 316, 429` |
| `_subtractPoints` (HP damage with CON bonus, `hpMod = delta * conBonus * task.priority * 2`) | `:112-124` |
| `_addPoints` (EXP `round(delta*intBonus*priority*crit*6)`, GP with streak bonus `currStreak/100 + 1`) | `:126-157` |
| critical hits (`crit.crit(user)`) | `:164-166` |
| automatic stat allocation `user.stats.training[attribute]` | `:174-176` |
| quest progress `user.party.quest.progress.up` | `:178-194` |
| streak achievement at multiples of 21 | `:339-343, 371-374` |
| `user.achievements.completedTask`, onboarding | `:441-444` |
| "streaks" buff protecting streak on miss | `:310` |
| `req.yesterDailyScored = task.yesterDailyScored` (dead: nothing sets `yesterDailyScored`) | `:438` |
| group task (`task.group.*`) completion bookkeeping | `:319-337, 357-369, 390-405, 413-420` |
| server wrapper: `randomDrop`, webhooks, challenge/team mirror scoring (`scoreChallengeTask`) | `libs/tasks/index.js:480, 510, 608-609`; `models/task.js:287-341` |

Cron-side stripped: login incentives, subscription perks, `user.history.exp`, perfect-day buffs, stealth buff (`evadeTask`), sleep/inn (`user.preferences.sleep` skips daily penalties; keep if you want a "pause"), quest boss damage `progress.down += delta * (priority < 1 ? priority : 1)`, MP regen, `CRON_SAFE_MODE`/`CRON_SEMI_SAFE_MODE`, pinned items, `UserHistory` audit.

---

## 3. Value -> colour

Thresholds (`website/client/src/store/getters/tasks.js:23-42`):

```js
function getTaskColor (task) {
  if (task.type === 'reward' || task.byHabitica) return 'purple';
  const { value } = task;
  if (value < -20) return 'worst';
  if (value < -10) return 'worse';
  if (value < -1)  return 'bad';
  if (value < 1)   return 'neutral';
  if (value < 5)   return 'good';
  if (value < 10)  return 'better';
  return 'best';
}
```

Colours (`website/client/src/assets/scss/task.scss` with variables from `website/client/src/assets/scss/colors.scss`):

| class | range | control bg (`$x-100`) | hex | checkbox/icon/text (`$x-1`) | hex | modal option label |
|---|---|---|---|---|---|---|
| `worst` | v < -20 | `$maroon-100` | `#DE3F3F` | `$red-1` | `#6C0406` | `$maroon-50 #C92B2B` |
| `worse` | -20 ≤ v < -10 | `$red-100` | `#FF6165` | `$red-1` | `#6C0406` | `$red-10 #F23035` |
| `bad` | -10 ≤ v < -1 | `$orange-100` | `#FF944C` | `$orange-1` | `#7F3300` | `$orange-1` |
| `neutral` | -1 ≤ v < 1 | `$yellow-100` | `#FFBE5D` | `$yellow-1` | `#794B00` | `#bf7d1a` |
| `good` | 1 ≤ v < 5 | `$green-100` | `#24CC8F` | `$green-1` | `#005737` | `#1ca372` (icon `$green-10 #1CA372`) |
| `better` | 5 ≤ v < 10 | `$teal-100` | `#3BCAD7` | `$teal-1` | `#005158` | `$teal-10 #26A0AB` |
| `best` | v ≥ 10 | `$blue-100` | `#50B5E9` | `$blue-1` | `#033F5E` | `$blue-10 #2995CD` |
| `purple` | byHabitica / create modal | `$purple-task` | `#925cf3` | modal bg `$purple-300` | `#6133B4` | `$purple-200 #4F2A93` |

Overlay rules shared by all colour classes (`task.scss:29-40`): habit "+"/"−" inner button `rgba($black, 0.25)` (orange/yellow use `rgba($x-1, 0.25)`); daily/todo checkbox well `rgba($white, 0.5)`; hover on habit control `rgba($black|$x-1, 0.5)`, on daily/todo control `rgba($white, 0.75)`; non-interactive habit inner: `1px solid rgba($x-1, 0.5)`.

Disabled states (`task.scss:293-331`): completed todo / not-due-today or completed daily: control bg `$gray-200 #878190`, checkbox `$gray-10 #34313A`, content bg `$gray-600 #EDECEE` with title/notes at 0.75 opacity. Disabled habit direction (`up`/`down` false): bg `$gray-600 #EDECEE`, inner border `$gray-300 #A5A1AC`, icons `$gray-200 #878190`.

When the disabled control is used (`getters/tasks.js:172-186`): daily/todo is `task.completed`, or a daily that `!shouldDo(dueDate, task, userPreferences)`.

Full palette for reference (`colors.scss:8-66`): gray 10 `#34313A`, 50 `#4E4A57`, 100 `#686274`, 200 `#878190`, 300 `#A5A1AC`, 400 `#C3C0C7`, 500 `#E1E0E3`, 600 `#EDECEE`, 700 `#F9F9F9`; red 1 `#6C0406`, 10 `#F23035`, 50 `#F74E52`, 100 `#FF6165`, 500 `#FFB6B8`; maroon 10 `#B01515`, 50 `#C92B2B`, 100 `#DE3F3F`, 500 `#F19595`; orange 1 `#7F3300`, 10 `#F47825`, 50 `#FA8537`, 100 `#FF944C`, 500 `#FFC8A7`; yellow 1 `#794B00`, 5 `#EE9109`, 10 `#FFA624`, 50 `#FFB445`, 100 `#FFBE5D`, 500 `#FEDEAD`; green 1 `#005737`, 10 `#1CA372`, 50 `#20B780`, 100 `#24CC8F`, 500 `#77F4C7`; teal 1 `#005158`, 10 `#26A0AB`, 50 `#34B5C1`, 100 `#3BCAD7`, 500 `#8EEDF6`; blue 1 `#033F5E`, 10 `#2995CD`, 50 `#46A7D9`, 100 `#50B5E9`, 500 `#A9DCF6`; purple 50 `#36205D`, 100 `#432874`, 200 `#4F2A93`, 300 `#6133B4`, 400 `#925CF3`, 500 `#BDA8FF`, 600 `#D5C8FF`.

Client habit filter (`client/src/libs/store/helpers/filterTasks.js:10-11`): "weak" = `value < 1`, "strong" = `value >= 1`.

---

## 4. Task history

`history` is an untyped `Array` on habits and dailies (`models/task.js:346-351`) — "Schema for history not defined because it causes serious perf problems". `date` is stored as a **Number** (ms since epoch; `Number(new Date())`), not a Date.

### 4.1 Habit entries — one bucket per user-day

Shape: `{ date: Number, value: Number, scoredUp: Number, scoredDown: Number }`.

"Same day" test (`scoreTask.js:212-225`):

```js
function _lastHistoryEntryWasToday (lastHistoryEntry, user) {
  if (!lastHistoryEntry || !lastHistoryEntry.date) return false;
  const timezoneUtcOffset = getUtcOffset(user);        // = -(user.preferences.timezoneOffset || 0), minutes
  const { dayStart } = user.preferences;
  const dateWithTimeZone = moment(lastHistoryEntry.date).utcOffset(timezoneUtcOffset);
  if (dateWithTimeZone.hour() < dayStart) dateWithTimeZone.subtract(1, 'day');
  return moment().utcOffset(timezoneUtcOffset).isSame(dateWithTimeZone, 'day');
}
```

Note the asymmetry: the stored entry is shifted back a day when before `dayStart`, but "now" is not. Between midnight and `dayStart` a fresh entry is therefore always pushed. Minor; decide whether to replicate.

Update path (`scoreTask.js:227-241`): `value = task.value; date = now; scoredUp += times` (or `scoredDown += times`). Push path: `scoredUp = 1 / scoredDown = 1` (see §2.3 note on `times`).

### 4.2 Daily entries — one per completion and one per missed-cron

Shape: `{ date: Number, value: Number, isDue: Boolean, completed: Boolean }`.

- On check: pushed with `completed: true`, `isDue: task.isDue` (`scoreTask.js:346-354`).
- On uncheck: last entry removed (`scoreTask.js:378-381`).
- At cron (`libs/cron.js:291-297`): for **every daily that is not completed** (due or not — `isDue` records whether it was), push `{ date, value, isDue: task.isDue, completed: false }`. The `isDue` written here is the *pre-cron* `isDue` (i.e. was it due on the day that just ended); `setIsDueNextDue` runs afterwards (`cron.js:301`).
- Completed dailies get no cron entry (their check entry stands).

### 4.3 User-level todo history (`libs/cron.js:190-208`, `models/user/schema.js:348-351`)

`user.history.todos.push({ date: now.toISOString(), value: todoTally })` where `todoTally` = sum of `task.value` over all uncompleted todos after their cron decay. (`date` here is an ISO string, unlike task history.) `user.history.exp` is stripped.

### 4.4 Pruning / compression — `website/server/libs/preening.js`

Triggered from cron (`preenUserHistory`, `preening.js:68-98`) for every habit and daily whose `history.length > minHistoryLength` (60 free / 365 subscriber), plus `user.history.todos`.

```js
export function preenHistory (history, isSubscribed, timezoneUtcOffset = 0, dayStart = 0) {
  const now = moment().utcOffset(timezoneUtcOffset);
  const cutOff = now.subtract(isSubscribed ? 365 : 60, 'days').startOf('day');

  // keep, uncompressed, entries whose CDS-adjusted date >= cutOff (null entries are dropped)
  const newHistory = _.remove(history, entry => { ...entryDate >= cutOff... });

  const monthsCutOff = cutOff.subtract(isSubscribed ? 12 : 10, 'months').startOf('day');
  const aggregateByMonth = _.remove(history, entry => { ...entryDate >= monthsCutOff... });

  if (aggregateByMonth.length > 0) newHistory.unshift(..._aggregate(aggregateByMonth, 'YYYYMM', ...));
  if (history.length > 0)          newHistory.unshift(..._aggregate(history, 'YYYY', ...));
  return newHistory;
}
```

Tiers: free users — last 60 days raw, then 10 months at one entry per month, then one entry per year. Subscribers — 365 days raw, 12 months monthly, then yearly. (`cutOff`/`monthsCutOff` are mutated in place by `subtract`; `monthsCutOff` is `cutOff − N months`.)

`_aggregate` (`preening.js:5-26`): group by `moment(entry.date).utcOffset(tz)` (minus one day if `hour() < dayStart`) formatted as `YYYYMM` or `YYYY`; sort groups by key; each group becomes `{ date: Number(entries[0].date), value: mean(entry.value) }`. Aggregated entries therefore **lose** `scoredUp/scoredDown/isDue/completed`. Note the CDS-adjusted day is used for grouping but the raw first `date` is kept.

Ordering caveat: yearly aggregates are `unshift`ed after monthly ones, so the final array is `[yearly..., monthly..., raw...]` — chronological only if the raw tail was chronological, which it is.

### 4.5 What the client shows

The web client renders **no** task history: the only consumer is the CSV export `GET /export/history.csv` (`controllers/top-level/dataexport.js:38-74`) with columns `Task Name, Task ID, Task Type, Date (YYYY-MM-DD HH:mm:ss), Value`, habits and dailies only. The task list shows `streak` for dailies and `counterUp`/`counterDown` for habits (`client/src/components/tasks/task.vue:256-296`: `+N | -M` when both directions enabled, bare `N` when only one). Mobile apps chart the history; the web does not.

---

## 5. Checklists

Item schema (`models/task.js:358-366`), dailies and todos only:

| field | type | default | notes |
|---|---|---|---|
| `id` | String | `uuid()` | UUID, required; client-supplied id is stripped by `Task.sanitizeChecklist` (`task.js:275-278`) |
| `text` | String | `''` | not required ("can be empty on creation") |
| `completed` | Boolean | `false` | |
| `linkId` | String | — | group-task linkage; **drop** |

`collapseChecklist: Boolean, default false` on the task (`task.js:357`) — pure UI state, persisted.

Endpoints (`api-v3/tasks.js`): `POST /tasks/:taskId/checklist` (push item), `POST /tasks/:taskId/checklist/:itemId/score` (**toggles** `item.completed = !item.completed`; nothing else changes — no value change, no delta), `PUT /tasks/:taskId/checklist/:itemId` (merge sanitized body), `DELETE /tasks/:taskId/checklist/:itemId`. All 400 `checklistOnlyDailyTodo` for habits. `PUT /tasks/:id` with `checklist` replaces the whole array.

Effect on value (all in §2.1):

- Daily, cron miss: `delta *= 1 − completedItems/totalItems`. A daily with all items checked but not itself checked loses nothing (delta 0) but still gets `streak = 0` and a `completed:false` history entry.
- Daily, interactive check/uncheck: **no effect**.
- Todo, interactive check: `delta *= 1 + completedItems`; uncheck: reverse delta × same multiplier (using the items' state at uncheck time — if items were toggled in between, the round-trip won't cancel).
- Todo, cron decay: **no effect**.

Cron reset (`libs/cron.js:303-307`): for dailies that were completed, or were due on a missed day (`scheduleMisses > 0`), every checklist item is set `completed = false`. Not-due, not-completed dailies keep their item state.

---

## 6. Tags

Schema (`models/tag.js:8-23`), embedded as `user.tags: [TagSchema]` (`models/user/schema.js:712`):

| field | type | default | notes |
|---|---|---|---|
| `id` | String | `uuid()` | UUID, required; `_id` disabled. Not updatable after creation (`noUpdate = ['id']`, `tag.js:31-34`). |
| `name` | String | — | required; no length limit |
| `challenge` | Boolean | — | auto-created challenge tag; noSet; **drop** |
| `group` | String | — | group id; noSet; **drop** |

`cleanupCorruptData` (`tag.js:41-49`) drops tags with no `id` or `name` on user load.

Order of `user.tags` is the display order. Endpoints (`api-v3/tags.js`): `POST /tags` (push sanitized body; response is the last tag), `GET /tags`, `GET /tags/:tagId`, `PUT /tags/:tagId` (merge sanitized body — effectively `name` only), `POST /reorder-tags` body `{tagId, to}` (splice out, splice in at `to`), `DELETE /tags/:tagId` (`$pull` from `user.tags` and `Task.updateMany({userId}, {$pull: {tags: id}})` across all the user's tasks).

Task side: `task.tags` is an array of tag UUIDs. `POST /tasks/:taskId/tags/:tagId` validates `tagId` is in `user.tags` (`isIn(userTags)`), 400 `alreadyTagged` if present, else push. `DELETE /tasks/:taskId/tags/:tagId` removes; 404 `tagNotFound` if absent. Both only for `userId === user._id` tasks. `PUT /tasks/:id` with `tags` replaces the array (no membership validation beyond "is a UUID").

Client: `getTagsFor(task)` = names of `user.tags` whose id is in `task.tags` (`getters/tasks.js:8-12`).

---

## 7. Task ordering — `user.tasksOrder`

Schema (`models/user/schema.js:720-725`):

```js
tasksOrder: {
  habits:  [{ $type: String, ref: 'Task' }],
  dailys:  [{ $type: String, ref: 'Task' }],   // note the spelling "dailys"
  todos:   [{ $type: String, ref: 'Task' }],
  rewards: [{ $type: String, ref: 'Task' }],
}
```

Key name is always `${task.type}s`.

Maintenance:

- **Create** (`libs/tasks/index.js:96-112`): new ids are `unshift`ed (top of list) — `$push: { 'tasksOrder.<type>s': { $each: [...ids], $position: 0 } }`. Multiple tasks in one request keep the request order at the top.
- **Delete** (`api-v3/tasks.js` `deleteTask`): `$pull` the id — unless it is a completed todo, which is not in the list.
- **Todo completion** (`libs/tasks/index.js:484-498, 588-602`): scoring a todo `up` (was incomplete, now complete) `$pull`s it from `tasksOrder.todos`; scoring `down` (was complete) `$push`es it to the **end** if absent. Completed todos live outside the order.
- **Cron** (`libs/cron.js:322-325`): `tasksOrder.todos` is filtered to the ids of still-incomplete todos.
- **Read repair** (`libs/tasks/index.js:264-317`): on `GET /tasks/user` ids with no matching task are removed; tasks with no position are appended and persisted. Returned list = ordered ∪ unordered-appended. Client uses the same algorithm (`client/src/libs/store/helpers/orderTasks.js:5-22`).

Move endpoint `POST /tasks/:taskId/move/to/:position` (`api-v3/tasks.js:779-878`, `libs/tasks/utils.js:666-684`):

```js
export function moveTask (order, taskId, to) {
  const currentIndex = order.indexOf(taskId);
  // push to end if target slot doesn't exist and it's not -1
  if (!order[to] && to !== -1) { order.push(taskId); return; }
  if (currentIndex !== -1) order.splice(currentIndex, 1);
  if (to === -1) order.push(taskId);
  else order.splice(to, 0, taskId);
}
```

Semantics: `position` is a 0-based index into the type's order; `-1` = bottom; an out-of-range index also = bottom (note the early-return path does **not** remove the current position, so an out-of-range move of an already-ordered task duplicates the id in the in-memory array that is echoed back in the response; the persisted order is still correct because the server does `$pull` then `$push` — a latent bug in the response only; fix it). Completed todos cannot be moved (400 `cantMoveCompletedTodo`). Persistence is `$pull` then `$push {$each:[id], $position: (to === -1 ? order.length - 1 : to)}`. Response is the whole updated order array.

Related: `GET /tasks/user?type=todos` excludes completed; `type=completedTodos` returns completed sorted by `dateCompleted` desc, unordered. `POST /tasks/clearCompletedTodos` deletes all completed user todos (challenge/group excluded). Cron deletes completed todos with `dateCompleted < now − 30 days` (90 for subscribers) (`libs/cron.js:444-453`).

---

## 8. Dates: todo `date`, daily `startDate`, `yesterDaily`

### 8.1 Todo `date` (due date)

Plain optional `Date` (`task.js:417`). The server never reads it. Client (`task.vue:1120-1134`):

```js
calculateTimeTillDue () {
  const endOfToday = moment().subtract(this.user.preferences.dayStart, 'hours').endOf('day');
  const endOfDueDate = moment(this.task.date).endOf('day');
  return moment.duration(endOfDueDate.diff(endOfToday));
}
checkIfOverdue () { return this.calculateTimeTillDue().asDays() < 0; }
formatDueDate () { return moment().isSame(this.task.date, 'day') ? 'today' : moment(this.task.date).format(dateFormat) }
```

"Scheduled" filter = incomplete todos with a `date`, sorted ascending by `date` (`filterTasks.js:26`). Overdue does not affect value; cron decay is the same for all incomplete todos.

### 8.2 Daily `startDate`

Stored as a Date whose **time portion is meaningless**; only the calendar day in the user's timezone matters (`common/cron.js:118-125`: "The time portion of the Start Date is never visible to or modifiable by the user so we must ignore it"). Normalisation on create and update (`libs/tasks/utils.js:686-699`):

```js
export function normalizeDailyStartDate (date, user) {
  if (!date) return date;
  const utcView = moment.utc(date);
  const looksLikeMidnightLocal = utcView.second() === 0 && utcView.millisecond() === 0
    && [0, 15, 30, 45].includes(utcView.minute());
  if (looksLikeMidnightLocal) return new Date(date);
  return moment(date).utcOffset(-(user.preferences.timezoneOffset || 0)).startOf('day').toDate();
}
```

I.e. if it already looks like a local midnight (any tz with :00/:15/:30/:45 offset) keep it; otherwise snap to start of day in the user's tz.

Due computation `shouldDo(day, task, prefs)` (`common/cron.js:111-252`), using `startOfDay` = `day` at `dayStart` hours, minus a day if `day.hour() < dayStart` (`cron.js:83-92`), then compared at date granularity:

- `type !== 'daily'`, `startDate === null`, `everyX < 1`, `everyX > 9999` -> false.
- `startDate > today` -> false (future start).
- `daily`: due when `(today − startDate) % everyX === 0` in days (moment-recur `every(everyX).days()`).
- `weekly`: due when today's weekday is enabled in `repeat` **and** `floor(weeks between startDate and today) % everyX === 0`. `repeat` all-false -> never due.
- `monthly`:
  - if `weeksOfMonth.length > 0`: due when weekday ∈ `repeat` and week-of-month ∈ `weeksOfMonth` (moment-recur `weeksOfMonthByDay`, 0-based), and `(months between startOfMonth(startDate) and startOfMonth(today)) % everyX === 0`; `repeat` all-false -> never.
  - else if `daysOfMonth.length > 0`: due when day-of-month ∈ `daysOfMonth` and the same month-modulus holds.
  - else: only the month-modulus (`schedule.matches` on a bare recur — effectively matches every day; edge case, treat as "no rule").
- `yearly`: due when today is `startDate + k*everyX years` (same month/day).

`nextDue` mode (`options.nextDue = true`) returns up to 6 upcoming due moments (ignoring the future-start rule). `setNextDue` (`utils.js:701-733`) writes `task.isDue` and `task.nextDue = [ISO strings]` on create, update, score and cron.

`DAY_MAPPING` (`cron.js:12-20`): `0:'su', 1:'m', 2:'t', 3:'w', 4:'th', 5:'f', 6:'s'`.

Missed-day detection at cron (`libs/cron.js:236-248`): for `i` in `0..daysMissed-1`, `thatDay = now − (i+1) days`, `shouldDo(thatDay, task, prefs)` — but `break`s after the first iteration because `multiDaysCountAsOneDay`. So only "yesterday" is checked; a daily due three days ago but not yesterday is not penalised after a 3-day absence. `daysMissed` comes from `daysSince(lastCron, {now, dayStart, timezoneOffset})` (`common/cron.js:98-104`) = difference in CDS-adjusted day starts.

### 8.3 `yesterDaily`

Boolean, default `true`, required (`task.js:411`). Server never reads it apart from letting it be set. Client (`client/src/components/notifications.vue:611-640`): before triggering cron, collect dailies that are not completed, not group tasks, `shouldDo(yesterday@dayStart, task)` and `task.yesterDaily === true`; if any, show the "Yesterdailies" modal so the user can tick what they actually did yesterday; ticked ones are bulk-scored `up` (`yesterdailyModal.vue:132-135`) and then cron runs. `yesterDaily === false` opts a daily out of that prompt (it is then simply penalised). It is a per-task preference, nothing more.

---

## 9. Aliases

`alias: String` (`task.js:66-91`):

- `match: /^[a-zA-Z0-9-_]+$/` — "Task short names can only contain alphanumeric characters, underscores and dashes."
- `!validator.isUUID(val)` — "Task short names cannot be uuids."
- `Boolean(this.userId)` — only on a user's own tasks.
- Unique per user: `Task.findOne({ _id: {$ne: this._id}, userId, alias })` must be empty — "Task alias already used on another task." Batch create also rejects duplicate aliases within one request (`utils.js:634-646`).

Resolution (`task.js:190-210`): every `:taskId` route param goes through `findByIdOrAlias(identifier, userId)`: if `validator.isUUID(identifier)` query `{_id}`, else `{userId, alias}`. Bulk scoring accepts a mix (`findMultipleByIdOrAlias`, `task.js:212-250`).

---

## 10. Miscellany worth knowing before reimplementing

- **`priority` has zero influence on `value`.** In Habitica it only scales exp/gp/hp. Without gamification it is decoration. Either keep it as a label, or wire it into the delta yourself (that would be a deliberate deviation).
- **Habit "−" ≠ mirror of "+".** "+" uses `0.9747^v`; "−" uses the reverse solver, which is slightly larger in magnitude (see table). Cron-side downs (todo decay, missed dailies) use the plain `−0.9747^v`.
- The two `delta = _calculateDelta(...)` recalculations on uncheck (`scoreTask.js:313, 424`) only feed exp/gp. The value change actually applied is the reverse delta. If you return a delta from your API, decide which one you mean.
- `streak` can go negative via repeated unchecks; nothing clamps it. `Math.trunc` on PUT is the only normalisation.
- `history[].date` is a Number (ms); `user.history.todos[].date` is an ISO string. Pick one.
- Aggregated history entries drop the extra fields; consumers must treat `scoredUp/scoredDown/isDue/completed` as optional.
- Task creation forces `text` but no maximum length; nothing trims whitespace.
- User preferences that scoring/cron depend on: `preferences.dayStart` (Number 0-23, default 0; `user/schema.js:547`), `preferences.timezoneOffset` (minutes, sign as JS `Date#getTimezoneOffset`, default 0; `:562`), `preferences.timezoneOffsetAtLastCron`, `preferences.dateFormat` (enum `MM/dd/yyyy`, `dd/MM/yyyy`, `yyyy/MM/dd`), `preferences.tasks.activeFilter.{habit:'all',daily:'all',todo:'remaining',reward:'all'}` (`:642-647`), `preferences.newTaskEdit`, `preferences.dailyDueDefaultView`. `getUtcOffset(user) = -(timezoneOffset || 0)` (`common/script/fns/getUtcOffset.js`).
- The scoring API does not check `task.up`/`task.down`. Add that check.
