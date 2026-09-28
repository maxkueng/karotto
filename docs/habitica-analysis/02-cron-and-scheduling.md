# 02 — Cron (day rollover), daily scheduling / "due" logic, time handling

Source root (`ROOT`): `/tmp/claude-1000/-home-max-projects-karotto/056b76f6-667d-4225-beac-6be61ca77ec1/scratchpad/habitica`
All paths below are relative to `ROOT`. Line numbers are from the checked-out tree.

`moment-recur` is not in `node_modules`; the exact pinned fork
(`git://github.com/HabitRPG/moment-recur.git#d3e8e6da...`, `package.json:55`) was fetched to
`../analysis/moment-recur.js` and is quoted where its semantics matter.

Contents

1. Time model and helpers (`sanitizeOptions`, `startOfDay`, `daysSince`, offsets, CDS, DST)
2. `shouldDo(day, task, options)` — full algorithm, per frequency
3. `nextDue` computation and where `isDue` / `nextDue` are (re)computed and persisted
4. Cron: `daysUserHasMissed`, `cronWrapper` (trigger, lock, cleanup), `cron()` (rollover) — gamification stripped
5. The "Record Yesterday's Activity" (yesterdailies) client flow and API
6. Todos: due date, `dateCompleted`, completed list, archival
7. Habits: counter frequency and reset, value decay
8. Client column filters (exact predicates)
9. Task defaults / start date normalisation on create & update
10. Stripped gamification (checklist of what was removed)
11. Quirks and bugs worth knowing before reimplementing

---

## 1. Time model and helpers

File: `website/common/script/cron.js`

### 1.1 User preferences involved

`website/server/models/user/schema.js`

```js
547:    dayStart: {
548:      $type: Number, default: 0, min: 0, max: 23,
549:    },
...
562:    timezoneOffset: { $type: Number, default: 0 },
...
565:    timezoneOffsetAtLastCron: Number,
...
572:    sleep: { $type: Boolean, default: false },
...
471:  lastCron: { $type: Date, default: Date.now },
472:  _cronSignature: { $type: String, default: 'NOT_RUNNING' }, // Private property used to avoid double cron
```

Pre-save hook clamps `dayStart` (`website/server/models/user/hooks.js:380-387`):

```js
  if (this.isDirectSelected('preferences')) {
    if (
      _.isNaN(this.preferences.dayStart)
      || this.preferences.dayStart < 0
      || this.preferences.dayStart > 23
    ) {
      this.preferences.dayStart = 0;
    }
  }
```

**Sign convention of `timezoneOffset`**: it is the *legacy* `Date.prototype.getTimezoneOffset()` /
`moment#zone` convention — **minutes to add to local time to get UTC**, i.e. UTC+2 is `-120`,
UTC-5 is `+300`. Everywhere in the code this is negated into a moment-style `utcOffset`:

`website/common/script/fns/getUtcOffset.js`
```js
10: export default function getUtcOffset (user) {
11:   return -(user.preferences.timezoneOffset || 0);
12: }
```

The browser sends its current offset on every request in the legacy convention
(`website/client/src/libs/auth.js:20-27`):
```js
  const browserTimezoneUtcOffset = moment().utcOffset();
  ...
    // Communicate in "old" timezone variant for backwards compatibility
    axios.defaults.headers.common['x-user-timezoneOffset'] = -browserTimezoneUtcOffset;
```
The server reads this header only inside `daysUserHasMissed` (section 4.1) and, if it differs from
`preferences.timezoneOffset`, overwrites the preference. That is the only mechanism by which the
stored timezone changes (also covers DST transitions: after a DST switch the browser's offset changes,
the header changes, the preference is rewritten, and the "timezone changed" branch of
`daysUserHasMissed` runs).

### 1.2 `sanitizeOptions` (`cron.js:32-61`)

Every date computation goes through this. Quoted verbatim:

```js
function sanitizeOptions (o) {
  const ref = Number(o.dayStart || 0);
  const dayStart = !Number.isNaN(ref) && ref >= 0 && ref <= 24 ? ref : 0;

  let timezoneUtcOffset;
  const timezoneUtcOffsetDefault = moment().utcOffset();

  if (Number.isFinite(o.timezoneUtcOffset)) {
    // Options were already sanitized
    timezoneUtcOffset = o.timezoneUtcOffset;
  } else if (Number.isFinite(o.timezoneUtcOffsetOverride)) {
    timezoneUtcOffset = o.timezoneUtcOffsetOverride;
  } else if (Number.isFinite(o.timezoneOffset)) {
    timezoneUtcOffset = -o.timezoneOffset;
  } else {
    timezoneUtcOffset = timezoneUtcOffsetDefault;
  }
  if (timezoneUtcOffset < -720 || timezoneUtcOffset > 840) {
    // timezones range from -12 (offset -720) to +14 (offset 840)
    timezoneUtcOffset = timezoneUtcOffsetDefault;
  }

  const now = moment(o.now).utcOffset(timezoneUtcOffset);
  // return a new object, we don't want to add "now" to user object
  return {
    dayStart,
    timezoneUtcOffset,
    now,
  };
}
```

Notes:
- `dayStart` accepted range here is `0..24` (schema says `0..23`). Invalid → `0`.
- Option precedence: `timezoneUtcOffset` (already sanitized) > `timezoneUtcOffsetOverride` >
  `timezoneOffset` (legacy sign, negated) > process-local `moment().utcOffset()` (server's own TZ —
  a footgun if a caller forgets to pass the user's preferences).
- Valid utcOffset range: `[-720, 840]` minutes; out of range → server default.
- `now` is a **fixed-offset** moment (`utcOffset(n)`), not an IANA zone. No DST rules are applied to
  any arithmetic; DST is handled solely by the browser header changing the stored offset.
- `o.now` may be undefined → `moment(undefined)` = current time.

### 1.3 `startOfWeek` (`cron.js:63-67`) — defined, **unused**

```js
export function startOfWeek (options = {}) {
  const o = sanitizeOptions(options);

  return moment(o.now).startOf('week');
}
```
`startOf('week')` is moment-locale dependent (Sunday for `en`). Nothing calls it (grep of `website/`
shows only the definition). **There is no user-configurable week start anywhere in Habitica.**

### 1.4 `startOfDay` (`cron.js:69-92`)

```js
/*
  This is designed for use with any date that has an important time portion
  (e.g., when comparing the current date-time with the previous cron's date-time
   for determining if cron should run now).
  It changes the time portion of the date-time to be the Custom Day Start hour,
  so that the date-time is now the user's correct start of day.
  It SUBTRACTS a day if the date-time's original hour is before CDS
  (e.g., if your CDS is 5am and it's currently 4am, it's still the previous day).
  This is NOT suitable for manipulating any dates that are displayed to the user
  as a date with no time portion, such as a Daily's Start Dates
  (e.g., a Start Date of today shows only the date,
  so it should be considered to be today even if the hidden time portion is before CDS).
 */

export function startOfDay (options = {}) {
  const o = sanitizeOptions(options);
  const dayStart = moment(o.now).startOf('day').add({ hours: o.dayStart });

  if (o.now.hour() < o.dayStart) {
    dayStart.subtract({ days: 1 });
  }

  return dayStart;
}
```

Result: a moment at `HH=dayStart:00:00` in the user's fixed offset, on the user's *current CDS day*
(calendar day, or the previous calendar day if local hour < dayStart). Test expectations
(`test/common/libs/cron.test.js:10-60`): now `2020-02-02 09:30Z`, dayStart 5 → `2020-02-02 05:00Z`;
now `04:30Z`, dayStart 5 → `2020-02-01 05:00Z`.

### 1.5 `daysSince` (`cron.js:94-104`)

```js
/*
  Absolute diff from "yesterday" till now
 */

export function daysSince (yesterday, options = {}) {
  const o = sanitizeOptions(options);
  const startOfNow = startOfDay(defaults({ now: o.now }, o));
  const startOfYesterday = startOfDay(defaults({ now: yesterday }, o));

  return startOfNow.diff(startOfYesterday, 'days');
}
```

= number of CDS-day boundaries crossed between `yesterday` and `now` (integer, truncated by moment's
`diff`). Because both endpoints are normalised to `dayStart:00` this is exact whole days. Tests
(`cron.test.js:137-183`): 7 days ago at 13:00 vs today 03:00 with dayStart 6 → `6`; 7 days ago at
08:00 vs today 17:00 with dayStart 11 → `8`.

### 1.6 The CDS-adjust idiom used elsewhere

The same "if hour < dayStart, it belongs to the previous day" rule is re-implemented ad hoc in:

- `website/common/script/ops/scoreTask.js:212-225` (`_lastHistoryEntryWasToday`):
  ```js
  const dateWithTimeZone = moment(lastHistoryEntry.date).utcOffset(timezoneUtcOffset);
  if (dateWithTimeZone.hour() < dayStart) dateWithTimeZone.subtract(1, 'day');

  return moment().utcOffset(timezoneUtcOffset).isSame(dateWithTimeZone, 'day');
  ```
- `website/server/libs/preening.js:8-9, 47-48, 56-57` (history compression buckets).
- `website/server/libs/cron.js:71-72` (habit counters; shifts the *offset* by `dayStart*60` minutes
  instead — see section 7).
- Client `task.vue:1121` (todo overdue): `moment().subtract(dayStart, 'hours').endOf('day')`.

---

## 2. `shouldDo(day, dailyTask, options)` — complete algorithm

File: `website/common/script/cron.js:106-252`. Also exported from `website/common/script/index.js:107`.

### 2.1 Day-name mapping (`cron.js:12-22`)

```js
export const DAY_MAPPING = {
  0: 'su',
  1: 'm',
  2: 't',
  3: 'w',
  4: 'th',
  5: 'f',
  6: 's',
};

export const DAY_MAPPING_STRING_TO_NUMBER = invert(DAY_MAPPING);
```
Weekday numbers are JS/moment `.day()` (0 = Sunday).

### 2.2 Daily task schema fields used (`website/server/models/task.js:378-412`)

```js
export const DailySchema = new Schema(_.defaults({
  frequency: { $type: String, default: 'weekly', enum: ['daily', 'weekly', 'monthly', 'yearly'] },
  everyX: {
    $type: Number,
    default: 1,
    validate: [
      val => val % 1 === 0 && val >= 0 && val <= 9999,
      'Valid everyX values are integers from 0 to 9999',
    ],
  },
  startDate: {
    $type: Date,
    default () {
      return moment.utc().toDate();
    },
    required: true,
  },
  repeat: { // used only for 'weekly' frequency,
    m: { $type: Boolean, default: true },
    t: { $type: Boolean, default: true },
    w: { $type: Boolean, default: true },
    th: { $type: Boolean, default: true },
    f: { $type: Boolean, default: true },
    s: { $type: Boolean, default: true },
    su: { $type: Boolean, default: true },
  },
  streak: { $type: Number, default: 0 },
  // Days of the month that the daily should repeat on
  daysOfMonth: { $type: [Number], default: () => [] },
  // Weeks of the month that the daily should repeat on
  weeksOfMonth: { $type: [Number], default: () => [] },
  isDue: { $type: Boolean },
  nextDue: [{ $type: String }],
  yesterDaily: { $type: Boolean, default: true, required: true },
}, habitDailySchema(), dailyTodoSchema()), subDiscriminatorOptions);
```
(`repeat` is also used by `monthly` + `weeksOfMonth`, despite the comment.)

### 2.3 Preamble (`cron.js:111-137`)

```js
export function shouldDo (day, dailyTask, options = {}) {
  if (dailyTask.type !== 'daily' || dailyTask.startDate === null || dailyTask.everyX < 1 || dailyTask.everyX > 9999) {
    return false;
  }
  const o = sanitizeOptions(options);
  const startOfDayWithCDSTime = startOfDay(defaults({ now: day }, o));

  // The time portion of the Start Date is never visible to
  // or modifiable by the user so we must ignore it.
  // Therefore, we must also ignore the time portion of the user's day start
  // (startOfDayWithCDSTime), otherwise the date comparison will be wrong for some times.
  // NB: The user's day start date has already been converted to the PREVIOUS
  // day's date if the time portion was before CDS.

  const startDate = moment(dailyTask.startDate).utcOffset(o.timezoneUtcOffset).startOf('day');

  if (startDate > startOfDayWithCDSTime.startOf('day') && !options.nextDue) {
    return false; // Daily starts in the future
  }

  const daysOfTheWeek = [];
  if (dailyTask.repeat) {
    for (const [repeatDay, active] of Object.entries(dailyTask.repeat)) {
      if (!Number.isFinite(parseInt(DAY_MAPPING_STRING_TO_NUMBER[repeatDay], 10))) continue; // eslint-disable-line no-continue, max-len
      if (active) daysOfTheWeek.push(parseInt(DAY_MAPPING_STRING_TO_NUMBER[repeatDay], 10));
    }
  }
```

Semantics:
1. Guard: not a daily, `startDate === null` (note: `undefined` passes!), `everyX < 1` or `> 9999`
   → `false`.
2. `startOfDayWithCDSTime` = the CDS-day that `day` belongs to, at `dayStart:00` in the user's offset
   (section 1.4). So `day = 2024-05-10 03:00` with dayStart 4 → the CDS day is 2024-05-09.
3. `startDate` = the task's start date, viewed in the user's offset, at 00:00 (time portion dropped).
4. **Mutation**: `startOfDayWithCDSTime.startOf('day')` **mutates** `startOfDayWithCDSTime` to 00:00
   of the CDS day. All later comparisons therefore use 00:00 of the CDS-adjusted calendar day. (Since
   `moment-recur#matches` strips time anyway this only affects the `nextDue` comparisons; see 3.)
5. Future start date → `false`, *unless* `options.nextDue` is set (nextDue must still be computable
   for not-yet-started dailies).
6. `daysOfTheWeek` = numeric weekdays whose `repeat[...]` is truthy; unknown keys ignored.

### 2.4 moment-recur semantics you must reproduce

`Recur.matches(date)` (`moment-recur.js:615-631`):
```js
        Recur.prototype.matches = function(dateToMatch, ignoreStartEnd) {
            var date = moment(dateToMatch).dateOnly();
            ...
            if (!ignoreStartEnd && !inRange(this.start, this.end, date)) { return false }
            if (isException(this.exceptions, date)) { return false; }
            if (!matchAllRules(this.rules, date, this.start)) { return false; }
            return true;
        };
```
- `dateOnly()` (`:723-730`): takes the moment's own Y-M-D (in its current utcOffset) and returns
  that date at 00:00 **UTC**. Both `this.start` (constructor, `:449-455`) and the date to match are
  converted this way, so all rule maths is on pure calendar dates in the user's offset.
- `inRange` (`:338-342`): `date < start` → no match. So **nothing matches before startDate**.
- All rules must match (`matchAllRules`, `:412-433`).

Interval rules (`days`, `years`) (`moment-recur.js:41-70`):
```js
        function matchInterval(type, units, start, date) {
            var diff = null;
            if (date.isBefore(start)) {
                diff = start.diff(date, type, true);
            } else {
                diff = date.diff(start, type, true);
            }
            if (type == 'days') {
                // if we are dealing with days, we deal with whole days only.
                diff = parseInt(diff);
            }
            for (var unit in units) {
                if (units.hasOwnProperty(unit)) {
                    unit = parseInt(unit, 10);
                    if ((diff % unit) === 0) {
                        return true;
                    }
                }
            }
            return false;
        }
```
- `days`: integer day difference, `diff % everyX === 0`.
- `years`: **fractional** year diff (moment `diff(...,'years',true)`), must be exactly divisible —
  effectively "same month and day-of-month as startDate, and (year diff) % everyX == 0". A Feb 29
  start will only match in years where Feb 29 exists (other years give a fractional diff).

Calendar rules (`daysOfWeek`, `daysOfMonth`, `weeksOfMonthByDay`) (`moment-recur.js:153-176`):
```js
        function matchCalendarRule(measure, list, date) {
            var unitType = unitTypes[measure];        // daysOfMonth→'date', daysOfWeek→'day', weeksOfMonthByDay→'monthWeekByDay'
            var unit = date[unitType]();
            if (list[unit]) {
                return true;
            }
            // match on end of month days
            if (unitType === 'date' && unit == date.add(1, 'months').date(0).format('D') && unit < 31) {
                while (unit <= 31) {
                    if (list[unit]) {
                        return true;
                    }
                    unit++;
                }
            }
            return false;
        }
```
- `daysOfMonth`: matches if the date's day-of-month is in the list, **or** the date is the last day of
  its month and any listed day ≥ that day (so `daysOfMonth: [31]` is due on Feb 28/29, Apr 30, ...).
  Allowed range `1..31` (`:90`).
- `daysOfWeek`: `date.day()` in list; range `0..6`.
- `weeksOfMonthByDay` (`:718-720`): `Math.floor((date.date()-1)/7)` — the **0-indexed occurrence of
  that weekday within the month** (0 = 1st…7th, 1 = 8th…14th, 2 = 15th…21st, 3 = 22nd…28th,
  4 = 29th…31st). Range `0..4`. Locale/week-start independent.
  (`monthWeek()` at `:704-711` is the calendar-week variant using `startOf('week')`; Habitica does
  **not** use it in `shouldDo`, only the tests do.)

### 2.5 `frequency === 'daily'` (`cron.js:139-153`)

```js
  if (dailyTask.frequency === 'daily') {
    if (!dailyTask.everyX) return false; // error condition
    const schedule = moment(startDate).recur()
      .every(dailyTask.everyX).days();

    if (options.nextDue) {
      const filteredDates = [];
      for (let i = 1; filteredDates.length < 6; i += 1) {
        const calcDate = moment(startDate).add(dailyTask.everyX * i, 'days');
        if (calcDate > startOfDayWithCDSTime) filteredDates.push(calcDate);
      }
      return filteredDates;
    }

    return schedule.matches(startOfDayWithCDSTime);
  }
```
Due iff `(cdsDay - startDate) in whole days` is ≥ 0 and `% everyX === 0`. Intervals are anchored to
`startDate`. `repeat` is ignored.

### 2.6 `frequency === 'weekly'` (`cron.js:154-178`)

```js
  } if (dailyTask.frequency === 'weekly') {
    let schedule = moment(startDate).recur();

    const differenceInWeeks = moment(startOfDayWithCDSTime).diff(moment(startDate), 'week');
    const matchEveryX = differenceInWeeks % dailyTask.everyX === 0;

    if (daysOfTheWeek.length === 0) return false;
    schedule = schedule.every(daysOfTheWeek).daysOfWeek();
    if (options.nextDue) {
      const filteredDates = [];
      for (let i = 0; filteredDates.length < 6; i += 1) {
        for (let j = 0; j < daysOfTheWeek.length && filteredDates.length < 6; j += 1) {
          const calcDate = moment(startDate).day(daysOfTheWeek[j]).add(dailyTask.everyX * i, 'weeks');
          if (calcDate > startOfDayWithCDSTime) filteredDates.push(calcDate);
        }
      }
      const sortedDates = filteredDates.sort((date1, date2) => {
        if (date1.toDate() > date2.toDate()) return 1;
        if (date2.toDate() > date1.toDate()) return -1;
        return 0;
      });
      return sortedDates;
    }

    return schedule.matches(startOfDayWithCDSTime) && matchEveryX;
  }
```
Due iff:
- at least one weekday enabled in `repeat` (else never due),
- `cdsDay.day()` is an enabled weekday, and `cdsDay >= startDate`,
- `floor((cdsDay - startDate) / 7 days) % everyX === 0`.

**Week boundary**: `moment.diff(..., 'week')` is a truncated 7-day count from `startDate`. It is
**not** aligned to calendar weeks and does not depend on any week-start setting. Example: everyX=2,
startDate Wednesday: days Wed..Tue (7 days) are "week 0" (due on enabled weekdays), the next 7 days
"week 1" (not due), etc. With everyX=1 the `% 1` is always 0, so it's simply "these weekdays, from
startDate on". Test: start `2017-11-19` (Sun), everyX 3, repeat Sunday → `2018-01-21` due (9 weeks;
`shouldDo.test.js:659-677`).

### 2.7 `frequency === 'monthly'` (`cron.js:179-234`)

```js
  } if (dailyTask.frequency === 'monthly') {
    let schedule = moment(startDate).recur();

    // Use startOf to ensure that we are always comparing month
    // to the next rather than a month from the day
    const differenceInMonths = moment(startOfDayWithCDSTime).startOf('month')
      .diff(moment(startDate).startOf('month'), 'month', true);

    const matchEveryX = differenceInMonths % dailyTask.everyX === 0;

    if (dailyTask.weeksOfMonth && dailyTask.weeksOfMonth.length > 0) {
      if (daysOfTheWeek.length === 0) return false;
      schedule = schedule.every(daysOfTheWeek).daysOfWeek()
        .every(dailyTask.weeksOfMonth).weeksOfMonthByDay();

      if (options.nextDue) {
        const filteredDates = [];
        for (let i = 1; filteredDates.length < 6; i += 1) {
          const recurDate = moment(startDate).add(dailyTask.everyX * i, 'months');
          const calcDate = recurDate.clone();
          calcDate.day(daysOfTheWeek[0]);

          const startDateWeek = Math.ceil(moment(startDate).date() / 7);
          let calcDateWeek = Math.ceil(calcDate.date() / 7);

          // adjust week since weeks will rollover to other months
          if (calcDate.month() < recurDate.month()) calcDate.add(1, 'weeks');
          else if (calcDate.month() > recurDate.month()) calcDate.subtract(1, 'weeks');
          else if (calcDateWeek > startDateWeek) calcDate.subtract(1, 'weeks');
          else if (calcDateWeek < startDateWeek) calcDate.add(1, 'weeks');

          calcDateWeek = Math.ceil(calcDate.date() / 7);

          if (
            calcDate >= startOfDayWithCDSTime
            && calcDateWeek === startDateWeek
            && calcDate.month() === recurDate.month()
          ) filteredDates.push(calcDate);
        }
        return filteredDates;
      }

      return schedule.matches(startOfDayWithCDSTime) && matchEveryX;
    } if (dailyTask.daysOfMonth && dailyTask.daysOfMonth.length > 0) {
      schedule = schedule.every(dailyTask.daysOfMonth).daysOfMonth();
      if (options.nextDue) {
        const filteredDates = [];
        for (let i = 1; filteredDates.length < 6; i += 1) {
          const calcDate = moment(startDate).add(dailyTask.everyX * i, 'months');
          if (calcDate >= startOfDayWithCDSTime) filteredDates.push(calcDate);
        }
        return filteredDates;
      }
    }

    return schedule.matches(startOfDayWithCDSTime) && matchEveryX;
  }
```

Two mutually exclusive modes, chosen by which array is non-empty (`weeksOfMonth` wins):

**(a) "Nth weekday of the month"** — `weeksOfMonth` non-empty. Due iff:
- `repeat` has ≥1 enabled weekday (else `false`),
- `cdsDay.day()` ∈ enabled weekdays,
- `floor((cdsDay.date()-1)/7)` ∈ `weeksOfMonth` (0-indexed occurrence: `[1]` = "2nd", `[4]` =
  "5th" which only exists in some months — the client warns `fifthWeekWarning`),
- `cdsDay >= startDate`,
- `monthsBetween(startOf(month of startDate), startOf(month of cdsDay)) % everyX === 0`.
  E.g. "2nd Tuesday every month" = `repeat: {t: true, others false}`, `weeksOfMonth: [1]`.

**(b) "Day(s) of the month"** — `daysOfMonth` non-empty. Due iff `cdsDay.date()` ∈ `daysOfMonth`
(with the end-of-month clamp from 2.4), `cdsDay >= startDate`, and the month-diff `% everyX === 0`.

**(c) neither array set** → the schedule has no rules → `matches` is true for every date ≥ startDate
→ due **every day** of matching months. Bug/edge; the client and the update endpoint always populate
one of the arrays (section 9), so treat (c) as invalid input.

`differenceInMonths` is computed between the 1st of each month (float diff, exact integer for
month-starts) so everyX alignment is by calendar month from startDate's month.

### 2.8 `frequency === 'yearly'` (`cron.js:235-250`)

```js
  } if (dailyTask.frequency === 'yearly') {
    let schedule = moment(startDate).recur();

    schedule = schedule.every(dailyTask.everyX).years();

    if (options.nextDue) {
      const filteredDates = [];
      for (let i = 1; filteredDates.length < 6; i += 1) {
        const calcDate = moment(startDate).add(dailyTask.everyX * i, 'years');
        if (calcDate > startOfDayWithCDSTime) filteredDates.push(calcDate);
      }
      return filteredDates;
    }

    return schedule.matches(startOfDayWithCDSTime);
  }
  return false;
}
```
Due iff same month and day-of-month as `startDate`, `cdsDay >= startDate`, and `(year diff) %
everyX === 0` (see 2.4 for the fractional-year caveat). Unknown frequency → `false`.

### 2.9 Summary of how CDS/timezone shift "today"

For a wall-clock instant `T` and user `{dayStart, timezoneOffset}`:
`cdsDay(T) = calendarDate(T in utcOffset(-timezoneOffset))`, minus one day if `hour(T local) < dayStart`.
`shouldDo(T, task)` evaluates the schedule at `cdsDay(T)`. The task's `startDate` is reduced to
`calendarDate(startDate in user's offset)` (its time and CDS are ignored, per the comment at
`cron.js:117-123`). Tests covering "before CDS is previous day": `shouldDo.test.js:83-125, 184-205,
254-290`.

---

## 3. `nextDue` and persistence of `isDue`/`nextDue`

### 3.1 Computation

`shouldDo(day, task, {..., nextDue: true})` returns an **array of up to 6 moments** (or `false`) —
code quoted in 2.5–2.8. Per frequency:

- daily: `startDate + everyX*i days` for i=1.., keep those `> startOfDayWithCDSTime` (00:00 of the CDS
  day, so today is excluded, tomorrow onward), first 6.
- weekly: for i=0.., for each enabled weekday j: `moment(startDate).day(dow_j) + everyX*i weeks`
  (`.day()` sets the weekday **within startDate's Sun–Sat week**, so it may produce dates before
  startDate for i=0; those are filtered by `> startOfDayWithCDSTime` only if in the past), keep `>`
  today, sort ascending, first 6. Note: this uses calendar-week alignment for the *candidate* dates
  while `matches`+`differenceInWeeks` uses 7-day-from-startDate alignment; they can disagree when
  startDate is not a Sunday and everyX > 1.
- monthly/daysOfMonth: `startDate + everyX*i months` (moment clamps the day-of-month), keep `>=`
  today (**today included**), first 6. Only startDate's day is generated even if `daysOfMonth` has
  more entries.
- monthly/weeksOfMonth: `recurDate = startDate + everyX*i months`; `calcDate = recurDate` moved to
  the first enabled weekday (`daysOfTheWeek[0]`) within its Sun–Sat week, then nudged ±1 week to land
  in the same 7-day bucket (`ceil(date/7)`) as startDate and the same month; push if `>=` today. Loop
  is `for (i = 1; filteredDates.length < 6; ...)` with no upper bound — if the condition can never be
  met it spins forever (only guarded by the `daysOfTheWeek.length === 0` early return).
- yearly: `startDate + everyX*i years`, keep `>` today, first 6.

The returned dates carry startDate's 00:00 time in the user's offset.

### 3.2 Where `isDue` / `nextDue` are computed and stored

They are **persisted on the task document** (schema `task.js:409-410`, not settable by clients:
`noSet` at `task.js:160`) and only refreshed at these points:

`website/server/libs/tasks/utils.js:77-109`
```js
export function setNextDue (task, user, dueDateOption) {
  if (task.type !== 'daily') return;

  let now = moment().toDate();
  let dateTaskIsDue = Date.now();
  if (dueDateOption) {
    // @TODO Add required ISO format
    dateTaskIsDue = moment(dueDateOption);

    // If not time is supplied. Let's assume we want start of Custom Day Start day.
    if (
      dateTaskIsDue.hour() === 0
      && dateTaskIsDue.minute() === 0
      && dateTaskIsDue.second() === 0
      && dateTaskIsDue.millisecond() === 0
    ) {
      dateTaskIsDue.add(user.preferences.timezoneOffset, 'minutes');
      dateTaskIsDue.add(user.preferences.dayStart, 'hours');
    }

    now = dateTaskIsDue;
  }

  const optionsForShouldDo = user.constructor.name === 'model' ? user.preferences.toObject() : _.cloneDeep(user.preferences);
  optionsForShouldDo.now = now;
  task.isDue = shared.shouldDo(dateTaskIsDue, task, optionsForShouldDo);

  optionsForShouldDo.nextDue = true;
  const nextDue = shared.shouldDo(dateTaskIsDue, task, optionsForShouldDo);
  if (nextDue && nextDue.length > 0) {
    task.nextDue = nextDue.map(dueDate => dueDate.toISOString());
  }
}
```
Called from:
- task creation: `website/server/libs/tasks/index.js:87`
- task update: `website/server/controllers/api-v3/tasks.js:677`
- after scoring a task: `website/server/libs/tasks/index.js:508`
- `GET /api/v3/tasks/user?dueDate=<date>`: `libs/tasks/index.js:258-262` recomputes for the given
  date (in-memory, `.lean()` docs, not saved). API doc at `controllers/api-v3/tasks.js:349-350`.
- cron, for every daily: `website/server/libs/cron.js:23-34`
  ```js
  function setIsDueNextDue (task, user, now) {
    const optionsForShouldDo = {
      dayStart: user.preferences.dayStart,
      timezoneOffset: user.preferences.timezoneOffset,
    };
    task.isDue = common.shouldDo(now, task, optionsForShouldDo);
    optionsForShouldDo.nextDue = true;
    const nextDue = common.shouldDo(now, task, optionsForShouldDo);
    if (nextDue && nextDue.length > 0) {
      task.nextDue = nextDue.map(dueDate => dueDate.toISOString());
    }
  }
  ```

Consequence: the stored `isDue` is "was due on the day of the last cron/edit/score". The web client's
**"Due"/"Not Due" filter uses the stored `task.isDue`** (section 8), while the checkbox greying uses a
live `shouldDo(new Date(), task, prefs)` (`website/client/src/store/getters/tasks.js:172-186`). Between
the CDS boundary and the cron run they can disagree; the client mitigates by forcing the yesterdailies
/ cron flow as soon as the user is active after `dayStart` (section 5).

### 3.3 Client display of `nextDue`

`grep -rn nextDue website/client/src` → no matches. The web client does not display next due dates;
the field exists for the API/mobile apps. The web edit modal only shows a textual repeat summary
(`website/client/src/components/tasks/taskModal.vue:1430-1515`, `taskSummary.vue:224-310`).

---

## 4. Cron

### 4.1 Trigger and `daysMissed`

Cron is **not** middleware any more. `website/server/middlewares/cron.js` does not exist. The only
trigger is an explicit request:

`website/server/controllers/api-v3/cron.js:6-24`
```js
/**
 * @api {post} /api/v3/cron Run cron
 * @apiName Cron
 * @apiDescription This causes cron to run. It assumes that the user has already been shown
 * the Record Yesterday's Activity ("Check off any Dailies you did yesterday") screen and
 * so it will immediately apply damage for incomplete due Dailies.
 * @apiGroup Cron
 *
 * @apiSuccess {Object} data An empty Object
 */
api.cron = {
  method: 'POST',
  url: '/cron',
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    await cronWrapper(req, res);
    res.respond(200, {});
  },
};
```
(The web client calls `/api/v4/cron`; v4 is a superset that falls through to v3 controllers.)

The client learns whether cron is pending via `needsCron` on `GET /user`
(`website/server/libs/user/index.js:28-33`):
```js
  if (!req.query.userFields) {
    const { daysMissed } = user.daysUserHasMissed(new Date(), req);
    userToJSON.needsCron = false;
    if (daysMissed > 0) userToJSON.needsCron = true;
    User.addComputedStatsToJSONObj(userToJSON.stats, userToJSON);
  }
```
(`daysUserHasMissed` may mutate `user.preferences.timezoneOffset` / `lastCron` here without saving;
that is intentional — the same computation is repeated inside cron.)

`daysMissed` — `website/server/models/user/methods.js:374-479`, quoted in full because the timezone
handling is subtle:

```js
schema.statics.daysUserHasMissed = function daysUserHasMissed (user, now, req = {}) {
  // If the user's timezone has changed (due to travel or daylight savings),
  // cron can be triggered twice in one day, so we check for that and use
  // both timezones to work out if cron should run.
  // CDS = Custom Day Start time.
  let timezoneUtcOffsetFromUserPrefs = common.fns.getUtcOffset(user);
  const timezoneUtcOffsetAtLastCron = Number.isFinite(user.preferences.timezoneOffsetAtLastCron)
    ? -user.preferences.timezoneOffsetAtLastCron
    : timezoneUtcOffsetFromUserPrefs;

  let timezoneUtcOffsetFromBrowser = typeof req.header === 'function' && -Number(req.header('x-user-timezoneoffset'));
  timezoneUtcOffsetFromBrowser = Number.isFinite(timezoneUtcOffsetFromBrowser)
    ? timezoneUtcOffsetFromBrowser
    : timezoneUtcOffsetFromUserPrefs;
  // NB: All timezone offsets can be 0, so can't use `... || ...` to apply non-zero defaults

  if (timezoneUtcOffsetFromBrowser !== timezoneUtcOffsetFromUserPrefs) {
    // The user's browser has just told Habitica that the user's timezone has
    // changed so store and use the new zone.
    user.preferences.timezoneOffset = -timezoneUtcOffsetFromBrowser;
    timezoneUtcOffsetFromUserPrefs = timezoneUtcOffsetFromBrowser;
  }

  let lastCronTime = user.lastCron;
  if (user.auth.timestamps.loggedIn < lastCronTime) {
    lastCronTime = user.auth.timestamps.loggedIn;
  }
  // How many days have we missed using the user's current timezone:
  let daysMissed = daysSince(lastCronTime, defaults({ now }, user.preferences));

  if (timezoneUtcOffsetAtLastCron !== timezoneUtcOffsetFromUserPrefs) {
    // Give the user extra time based on the difference in timezones
    if (timezoneUtcOffsetAtLastCron > timezoneUtcOffsetFromUserPrefs) {
      const differenceBetweenTimezonesInMinutes = timezoneUtcOffsetAtLastCron - timezoneUtcOffsetFromUserPrefs; // eslint-disable-line max-len
      now = moment(now).subtract(differenceBetweenTimezonesInMinutes, 'minutes'); // eslint-disable-line no-param-reassign, max-len
    }

    // Since cron last ran, the user's timezone has changed.
    // How many days have we missed using the old timezone:
    const daysMissedNewZone = daysMissed;
    const daysMissedOldZone = daysSince(lastCronTime, defaults({
      now,
      timezoneUtcOffsetOverride: timezoneUtcOffsetAtLastCron,
    }, user.preferences));

    if (timezoneUtcOffsetAtLastCron > timezoneUtcOffsetFromUserPrefs) {
      // The timezone change was in the unsafe direction.
      // E.g., timezone changes from UTC+1 (utcOffset 60) to UTC+0 (offset 0).
      //    or timezone changes from UTC-4 (utcOffset -240) to UTC-5 (utcOffset -300).
      // Local time changed from, for example, 03:00 to 02:00.

      if (daysMissedOldZone > 0 && daysMissedNewZone > 0) {
        // Both old and new timezones indicate that we SHOULD run cron, so
        // it is safe to do so immediately.
        daysMissed = Math.min(daysMissedOldZone, daysMissedNewZone);
        // use minimum value to be nice to user
      } else if (daysMissedOldZone > 0) {
        // The old timezone says that cron should run; the new timezone does not.
        // This should be impossible for this direction of timezone change, but
        // just in case I'm wrong...
        // TODO
        // ...
      } else if (daysMissedNewZone > 0) {
        // The old timezone says that cron should NOT run -- i.e., cron has
        // already run today, from the old timezone's point of view.
        // The new timezone says that cron SHOULD run, but this is almost
        // certainly incorrect.
        // This happens when cron occurred at a time soon after the CDS. When
        // you reinterpret that time in the new timezone, it looks like it
        // was before the CDS, because local time has stepped backwards.
        // To fix this, rewrite the cron time to a time that the new
        // timezone interprets as being in today.

        daysMissed = 0; // prevent cron running now
        const timezoneOffsetDiff = timezoneUtcOffsetFromUserPrefs - timezoneUtcOffsetAtLastCron;
        // e.g., for dangerous zone change: -300 - -240 = -60 or 600 - 660= -60

        user.lastCron = moment(lastCronTime).subtract(timezoneOffsetDiff, 'minutes');
        // NB: We don't change this.auth.timestamps.loggedin so that will still record
        // the time that the previous cron actually ran.
        // From now on we can ignore the old timezone:
        // This is still timezoneOffset for backwards compatibility reasons.
        user.preferences.timezoneOffsetAtLastCron = -timezoneUtcOffsetAtLastCron;
      } else {
        // Both old and new timezones indicate that cron should
        // NOT run.
        daysMissed = 0; // prevent cron running now
      }
    } else if (timezoneUtcOffsetAtLastCron < timezoneUtcOffsetFromUserPrefs) {
      daysMissed = daysMissedNewZone;
      // TODO: Either confirm that there is nothing that could possibly go wrong
      // here and remove the need for this else branch, or fix stuff.
      // ...
    }
  }

  return { daysMissed, timezoneUtcOffsetFromUserPrefs };
};
```

Summary:
- Base: `daysMissed = daysSince(user.lastCron, {now, dayStart, timezoneOffset})` = CDS-day
  boundaries crossed since last cron in the *current* timezone.
- The `auth.timestamps.loggedIn` clause is **dead code**: the schema field is `loggedin`
  (`schema.js:93`), so `undefined < date` is always false.
- If the stored offset differs from the offset at last cron (`timezoneOffsetAtLastCron`, written by
  cron at `libs/cron.js:157`):
  - "unsafe" direction = utcOffset decreased (e.g. DST fall-back, or westward travel; local clock
    stepped back). `now` is shifted back by the difference, `daysMissed` recomputed in the old zone,
    and cron runs only if both zones agree (using the min). If only the new zone says "run", cron is
    suppressed and `lastCron` is rewritten backwards by the offset diff so future checks in the new
    zone see it as today.
  - "safe" direction = utcOffset increased (DST spring-forward, eastward travel): new-zone count is
    used as is.
- `timezoneOffsetAtLastCron` is set only when cron actually runs (`cron.js:157`:
  `user.preferences.timezoneOffsetAtLastCron = -timezoneUtcOffsetFromUserPrefs;`).

Changing CDS resets the clock (`website/server/controllers/api-v3/user.js:1618-1634`):
```js
api.setCustomDayStart = {
  method: 'POST',
  middlewares: [authWithHeaders()],
  url: '/user/custom-day-start',
  async handler (req, res) {
    const { user } = res.locals;
    const { dayStart } = req.body;

    user.preferences.dayStart = dayStart;
    user.lastCron = new Date();

    await user.save();
    ...
```
i.e. changing `dayStart` counts as "cron just ran now" so the change never causes an immediate
extra rollover.

### 4.2 `cronWrapper` — locking, cleanup, save (`website/server/libs/cron.js:389-516`)

```js
// Wait 5 minutes before attempting another cron
const CRON_TIMEOUT_WAIT = new Date(5 * 60 * 1000).getTime();

async function checkForActiveCron (user, now, session) {
  // set _cronSignature to current time in ms since epoch time
  // so we can make sure to wait at least CRONT_TIMEOUT_WAIT before attempting another cron
  const _cronSignature = now.getTime();
  // Calculate how long ago cron must have been attempted to try again
  const cronRetryTime = _cronSignature - CRON_TIMEOUT_WAIT;

  // To avoid double cron we first set _cronSignature
  // and then check that it's not changed while processing
  const userUpdateResult = await User.updateOne({
    _id: user._id,
    $or: [ // Make sure last cron was successful or failed before cronRetryTime
      { _cronSignature: 'NOT_RUNNING' },
      { _cronSignature: { $lt: cronRetryTime } },
    ],
  }, {
    $set: {
      _cronSignature,
    },
  }, { session }).exec();

  // If the cron signature is already set, cron is running in another request
  // throw an error and recover later,
  if (userUpdateResult.matchedCount === 0 || userUpdateResult.modifiedCount === 0) {
    throw new Error('CRON_ALREADY_RUNNING');
  }
}

export async function cronWrapper (req, res) {
  const { user } = res.locals;
  if (!user) return null; // User might not be available when authentication is not mandatory

  const now = new Date();
  let session;

  try {
    await checkForActiveCron(user, now);
    const { daysMissed, timezoneUtcOffsetFromUserPrefs } = user.daysUserHasMissed(now, req);

    if (daysMissed <= 0) {
      if (user.isModified()) {
        user._cronSignature = 'NOT_RUNNING';
        await user.save();
      } else {
        await unlockUser(user);
      }
      return null;
    }

    // Clear old completed todos - 30 days for free users, 90 for subscribers
    // Do not delete challenges completed todos TODO unless the task is broken?
    // Do not delete group completed todos
    await Tasks.Task.deleteMany({
      userId: user._id,
      type: 'todo',
      completed: true,
      dateCompleted: {
        $lt: moment(now).subtract(user.isSubscribed() ? 90 : 30, 'days').toDate(),
      },
      'challenge.id': { $exists: false },
      'group.id': { $exists: false },
    }).exec();

    const tasks = await Tasks.Task.find({
      userId: user._id,
      $or: [ // Exclude completed todos
        { type: 'todo', completed: false },
        { type: { $in: ['habit', 'daily'] } },
      ],
    }, null).exec();
    const tasksByType = {
      habits: [], dailys: [], todos: [], rewards: [],
    };
    tasks.forEach(task => tasksByType[`${task.type}s`].push(task));

    // Run cron
    const progress = await cron({
      user,
      tasksByType,
      now,
      daysMissed,
      timezoneUtcOffsetFromUserPrefs,
      headers: req.headers,
    });

    // await Group.tavernBoss(user, progress);

    // Save user and tasks
    user._cronSignature = 'NOT_RUNNING';
    user.markModified('_cronSignature');
    user.auth.timestamps.loggedin = now;
    user.lastCron = now;

    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await user.save({ session });
      for (const index in tasks) {
        if (Object.prototype.hasOwnProperty.call(tasks, index)) {
          const task = tasks[index];
          // eslint-disable-next-line no-await-in-loop
          if (task.isModified()) await task.save({ session });
        }
      }
    });

    await Group.processQuestProgress(user, progress);

    // Reload user
    res.locals.user = await User.findOne({ _id: user._id }).exec();
    return null;
  } catch (err) {
    if (err.message !== 'CRON_ALREADY_RUNNING') {
      // For any other error make sure to reset _cronSignature
      // so that it doesn't prevent cron from running
      // at the next request
      await unlockUser(user);
    }

    throw err; // re-throw the original error
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
```

Concurrency: an atomic conditional `updateOne` sets `_cronSignature = now(ms)` only if it is
`'NOT_RUNNING'` or older than 5 minutes (stale lock recovery). Losing the race throws
`CRON_ALREADY_RUNNING` (which does *not* clear the lock). `lastCron` is set to the wall-clock `now`
at which cron ran (not to the CDS boundary). Note the cron **runs at most once per request** with
`daysMissed` possibly > 1; the loop inside handles multi-day absence (but see
`multiDaysCountAsOneDay`).

Only *the user's own* habits, dailies and **uncompleted** todos are loaded. Completed todos are never
touched by cron except for the 30/90-day deletion above.

### 4.3 `cron()` — the rollover, with stats removed (`website/server/libs/cron.js:150-387`)

Below is the algorithm with gamification excised. Relevant lines quoted verbatim.

**Setup** (`:151-157`)
```js
export async function cron (options = {}) {
  const {
    user, tasksByType, now = new Date(), daysMissed, timezoneUtcOffsetFromUserPrefs,
  } = options;
  ...
  user.preferences.timezoneOffsetAtLastCron = -timezoneUtcOffsetFromUserPrefs;
```

**Multi-day policy** (`:185-188`)
```js
  const multiDaysCountAsOneDay = true;
  // If the user does not log in for two or more days,
  // cron (mostly) acts as if it were only one day.
  // When site-wide difficulty settings are introduced, this can be a user preference option.
```
Hard-coded `true`. Effect: a daily is penalised at most once regardless of how many days were
missed, and **only "yesterday" (now − 1 day) is examined** for due-ness (the `break` at `:247`).

**Todos** (`:190-208`)
```js
  let todoTally = 0;
  // make uncompleted To Do's redder (further incentive to complete them)
  tasksByType.todos.forEach(task => {
    if (
      task.completed
      || (task.group.assignedDate
      && moment(task.group.assignedDate).isAfter(user.auth.timestamps.updated))
    ) return;
    scoreTask({
      task,
      user,
      direction: 'down',
      cron: true,
      times: multiDaysCountAsOneDay ? 1 : daysMissed,
    });

    todoTally += task.value;
  });
  user.history.todos.push({ date: now.toISOString(), value: todoTally });
```
Every uncompleted todo is scored `down` once per cron (`times: 1`). With `cron: true` the todo
branch of `scoreTask` only changes the value (`scoreTask.js:385-388`: `if (cron) { // don't touch
stats on cron`). Value delta per application (`scoreTask.js:18-56`):

```js
const MAX_TASK_VALUE = 21.27;
const MIN_TASK_VALUE = -47.27;
...
function _calculateDelta (task, direction, cron) {
  // Min/max on task redness
  const currVal = _getTaskValue(task.value);        // clamps to [MIN_TASK_VALUE, MAX_TASK_VALUE] for the exponent only
  let nextDelta = (0.9747 ** currVal) * (direction === 'down' ? -1 : 1);

  // Checklists
  if (task.checklist && task.checklist.length > 0) {
    // If the Daily, only dock them a portion based on their checklist completion
    if (direction === 'down' && task.type === 'daily' && cron) {
      nextDelta *= 1 - reduce(
        task.checklist,
        (m, i) => m + (i.completed ? 1 : 0),
        0,
      ) / task.checklist.length;
    }

    // If To Do, point-match the TD per checklist item completed
    if (task.type === 'todo' && !cron) {
      nextDelta *= 1 + reduce(task.checklist, (m, i) => m + (i.completed ? 1 : 0), 0);
    }
  }

  return nextDelta;
}
```
So a todo at value `v` gets `v -= 0.9747^clamp(v)` each cron (checklist ignored on cron). The task
value itself is not clamped; only the exponent's input is. `user.history.todos` receives one entry
per cron with the **sum** of all uncompleted todo values (user-level, used for the todo graph).
Note the `todoTally` loop only counts todos that were actually scored.

**Dailies** (`:213-308`), stripped of stats:
```js
  let dailyChecked = 0; // how many dailies were checked?
  let dailyDueUnchecked = 0; // how many dailies were un-checked?
  let atLeastOneDailyDue = false; // were any dailies due?
  ...
  tasksByType.dailys.forEach(task => {
    const isTeamBoardTask = task.group.id && !task.userId;
    if (
      !isTeamBoardTask && task.group.assignedDate
      && moment(task.group.assignedDate).isAfter(user.auth.timestamps.updated)
    ) return;
    const { completed } = task;
    // Deduct points for missed Daily tasks
    let evadeTask = 0;
    let scheduleMisses = 0;

    if (completed) {
      if (!isTeamBoardTask) dailyChecked += 1;
      if (!atLeastOneDailyDue) { // only bother checking until the first thing is found
        atLeastOneDailyDue = task.isDue;
      }
    } else {
      // dailys repeat, so need to calculate how many they've missed according to their own schedule
      for (let i = 0; i < daysMissed; i += 1) {
        const thatDay = moment(now).subtract({ days: i + 1 });

        if (shouldDo(thatDay.toDate(), task, user.preferences)) {
          atLeastOneDailyDue = true;
          scheduleMisses += 1;
          if (user.stats.buffs.stealth && !isTeamBoardTask) {
            user.stats.buffs.stealth -= 1;
            evadeTask += 1;
          }
        }
        if (multiDaysCountAsOneDay) break;
      }

      if (scheduleMisses > evadeTask) {
        // The user did not complete this due Daily
        // (but no penalty if cron is running in safe mode).
        if (CRON_SAFE_MODE) {
          dailyChecked += 1; // allows full allotment of mp to be gained
        } else {
          perfect = false;

          // Partially completed checklists dock fewer mana points
          if (task.checklist && task.checklist.length > 0) {
            const completedItems = task.checklist.filter(i => i.completed).length;
            const fractionChecked = completedItems / task.checklist.length;
            dailyDueUnchecked += 1 - fractionChecked;
            dailyChecked += fractionChecked;
          } else {
            dailyDueUnchecked += 1;
          }

          if (!user.preferences.sleep) {
            const delta = scoreTask({
              user,
              task,
              direction: 'down',
              times: multiDaysCountAsOneDay ? 1 : scheduleMisses - evadeTask,
              cron: true,
            });

            if (!CRON_SEMI_SAFE_MODE) {
              // Apply damage from a boss, less damage for Trivial priority (difficulty)
              user.party.quest.progress.down += delta * (task.priority < 1 ? task.priority : 1);
              ...
            }
          }
        }
      }

      // add history entry when task was not completed
      task.history.push({
        date: Number(new Date()),
        value: task.value,
        isDue: task.isDue,
        completed: false,
      });
    }

    task.completed = false;
    setIsDueNextDue(task, user, now);

    if (completed || scheduleMisses > 0) {
      if (task.checklist) {
        task.checklist.forEach(i => { i.completed = false; });
      }
    }
  });
```

Per daily, in order:

1. Skip group-assigned tasks assigned after the user's last update (group feature; drop).
2. `completed = task.completed` (captured *before* the reset).
3. **If completed**: no value change, no history entry (one was already pushed at completion time,
   see below), streak untouched (it was incremented at completion time).
4. **If not completed**: was it due "yesterday"? `thatDay = now − 1 day` (wall clock), evaluated with
   `shouldDo(thatDay, task, user.preferences)` — i.e. the CDS day containing `now − 24h`. Because of
   the `break`, only `i = 0` is ever evaluated; `scheduleMisses` is 0 or 1.
   - Due and not evaded (stealth buff — drop) and not sleeping (`preferences.sleep`, "resting in the
     inn" — drop): `scoreTask({direction:'down', times:1, cron:true})`. In `scoreTask`'s daily/cron
     branch (`scoreTask.js:306-310`):
     ```js
    if (cron) {
      delta += _changeTaskValue(user, task, direction, times, cron);
      _subtractPoints(user, task, stats, delta);
      // Chilling frost should not affect challenge or group dailies
      if (!user.stats.buffs.streaks || task.challenge.id || task.group.id) task.streak = 0;
    }
     ```
     → `value -= 0.9747^clamp(value) × (1 − checklistFraction)`; **`streak = 0`** (the
     `buffs.streaks` "Chilling Frost" exception is gamification — drop, so always reset).
     **Sleeping users skip `scoreTask` entirely, so their streak is preserved and value unchanged.**
   - Due or not, an **uncompleted daily always gets a history entry**:
     `{date: now(ms), value, isDue: <stored isDue before recompute>, completed: false}`.
     (So non-due, uncompleted dailies also get an entry every cron.)
5. `task.completed = false`.
6. `setIsDueNextDue(task, user, now)` recomputes `isDue` and `nextDue` for *today* (the CDS day of
   `now`).
7. Checklist items reset (`completed = false`) **only if** the daily was completed or was due
   yesterday (`scheduleMisses > 0`). A not-due, uncompleted daily keeps its partially-ticked
   checklist.

History entry at completion time (non-cron, `scoreTask.js:346-354`):
```js
          // Save history entry for daily
          task.history = task.history || [];
          const historyEntry = {
            date: Number(new Date()),
            value: task.value,
            isDue: task.isDue,
            completed: true,
          };
          task.history.push(historyEntry);
```
and on un-completing (`:378-381`) the last entry is popped:
```js
          // Delete history entry when daily unchecked
          if (task.history || task.history.length > 0) {
            task.history.splice(-1, 1);
          }
```
Streak at completion (`:338`, `:375`): `task.streak += 1` on up, `task.streak -= 1` on down
(un-check). `completed` toggled accordingly (`:344`, `:376`). Streak achievements every 21 → drop.

**Habits** (`:310`, `processHabits`) — see section 7.

**Housekeeping** (`:322-330, 380`)
```js
  // Remove any remaining completed todos from the list of active todos
  const incompleteTodoIds = tasksByType.todos.filter(task => !task.completed).map(task => task._id);
  user.tasksOrder.todos = user.tasksOrder.todos
    .filter(taskOrderId => incompleteTodoIds.includes(taskOrderId));
  ...
  // preen user history so that it doesn't become a performance problem
  // also for subscribed users but differently
  preenUserHistory(user, tasksByType);
  ...
  user.flags.cronCount += 1;
```
`preenUserHistory` (`website/server/libs/preening.js:38-98`) compresses `task.history` (habits,
dailies) and `user.history.{exp,todos}` when longer than 60 entries (365 for subscribers): keep 1
entry/day for the last 60 (365) days, then average per month for the previous 10 (12) months, then
average per year. Buckets are CDS-adjusted. Non-gamification, keep if you keep history.

### 4.4 What "cron" does *not* do

- It never evaluates dailies for today; `isDue` for today is a by-product of `setIsDueNextDue`.
- It does not touch completed todos (other than deleting old ones and pruning `tasksOrder.todos`).
- It does not fire reminders / notifications for tasks.

---

## 5. "Record Yesterday's Activity" (yesterdailies) flow

There is **no dedicated server endpoint**. The modal is purely client-driven; the server's only
contribution is `task.yesterDaily` (per-task opt-in flag, default `true`, settable via task
create/update incl. for challenge/group-linked copies: `task.js:257-271`) and `user.needsCron`.

### 5.1 Client (`website/client/src/components/notifications.vue`)

Mount: on app load `runForcedModals()` (`:453-457`) → `runYesterDailies()`. Activity listeners
(`:440-443`, throttled to 1 s, `:582-592`):
```js
    checkNextCron: throttle(function checkNextCron () {
      if (
        !this.$store.state.isRunningYesterdailies
        && this.nextCron
        && Date.now() > this.nextCron
      ) {
        Promise.all([
          this.$store.dispatch('user:fetch', { forceLoad: true }),
          this.$store.dispatch('tasks:fetchUserTasks', { forceLoad: true }),
        ]).then(() => this.runYesterDailies());
      }
    }, 1000),
    scheduleNextCron () {
      // Reset the yesterDailies array
      this.yesterDailies = [];

      // Open yesterdailies modal the next time cron runs
      const { dayStart } = this.user.preferences;
      let nextCron = moment().hours(dayStart).minutes(0).seconds(0)
        .milliseconds(0);

      const currentHour = moment().format('H');
      if (currentHour >= dayStart) {
        nextCron = nextCron.add(1, 'day');
      }

      // Setup a listener that executes 10 seconds after the next cron time
      this.nextCron = Number(nextCron.format('x'));
    },
```
(`currentHour >= dayStart` compares a string to a number; JS coerces, it works.) So: after the CDS
hour passes, the next mouse/keyboard/touch event refetches user+tasks; if `needsCron` is true the
flow starts.

```js
    async runYesterDailies () {
      if (this.$store.state.isRunningYesterdailies) return;
      this.$store.state.isRunningYesterdailies = true;

      if (!this.user.needsCron) {
        this.afterYesterdailies();
        return;
      }

      const { dailys } = this.$store.state.tasks.data;

      const yesterDay = moment().subtract('1', 'day').startOf('day').add({
        hours: this.user.preferences.dayStart,
      });

      const yesterUtcOffset = yesterDay.utcOffset();

      dailys.forEach(task => {
        if (task.group && task.group.id) return;
        if (task.completed) return;
        const due = shouldDo(yesterDay, task, { timezoneUtcOffset: yesterUtcOffset });
        if (task.yesterDaily && due) this.yesterDailies.push(task);
      });

      if (this.yesterDailies.length === 0) {
        await this.runCronAction();
        this.afterYesterdailies();
      } else {
        this.levelBeforeYesterdailies = this.user.stats.lvl;
        this.$root.$emit('bv::show::modal', 'yesterdaily');
      }
    },
    async runCronAction () {
      // Run Cron
      const response = await axios.post('/api/v4/cron');
      ...
      // Sync
      await Promise.all([
        this.$store.dispatch('user:fetch', { forceLoad: true }),
        this.$store.dispatch('tasks:fetchUserTasks', { forceLoad: true }),
      ]);
    },
    afterYesterdailies () {
      this.scheduleNextCron();
      this.$store.state.isRunningYesterdailies = false;
      ...
```
Candidate list = user's own (non-group) dailies that are **uncompleted**, have `yesterDaily === true`,
and were due on `yesterDay` = (calendar yesterday at `dayStart:00`, browser zone; `dayStart` is
passed as 0 here since only `timezoneUtcOffset` is given — the CDS was baked into the instant).
If none → cron immediately; else show modal `yesterdaily`.

Quirk: if the user opens the app between 00:00 and `dayStart`, "yesterday" here is calendar
yesterday, whereas server cron will penalise the CDS-day before *that* (`now − 24h` then
CDS-adjusted). Minor mismatch, worth fixing in a rewrite by using `startOfDay(now) − 1 day`.

`isRunningYesterdailies` (store flag, `website/client/src/store/index.js:135`) blocks task editing,
scoring, notifications and level-up modals while the flow is active (`task.vue:112, 1136, 1210`;
`notifications.vue:537, 683`).

### 5.2 The modal (`website/client/src/components/tasks/yesterdailyModal.vue`)

Non-dismissable (`no-close-on-backdrop`, `no-close-on-esc`, no header/footer). Title `welcomeBack`
("Welcome back!"), text `checkOffYesterDailies` ("Check off any Dailies you did yesterday:"), each
candidate rendered with the normal `<task>` component in `is-yesterdaily` mode with
`due-date = moment().subtract(1,'days')` (so checkbox colouring uses yesterday's due-ness). In that
mode the checkbox only toggles local state (`task.vue:1201-1205`):
```js
      if (this.isYesterdaily === true) {
        await this.beforeTaskScore(this.task);
        this.task.completed = !this.task.completed;
        this.playTaskScoreSound(this.task, direction);
      } else {
        this.taskScore(this.task, direction);
      }
```
Button `yesterDailiesCallToAction` ("Start My New Day!") → `processYesterdailies()`
(`yesterdailyModal.vue:128-191`):
```js
      const bulkScoreParams = this.yesterDailies
        .filter(yesterdaily => yesterdaily.completed)
        .map(yesterdaily => ({ id: yesterdaily._id, direction: 'up' }));

      if (bulkScoreParams.length > 0) {
        try {
          const bulkScoresponse = await this.$store.dispatch('tasks:bulkScore', bulkScoreParams);
          ...
        } catch (err) {
          this.yesterDailies.forEach(y => { y.completed = false; });
          this.isLoading = false;
          throw err;
        }
      }

      await this.cronAction();

      this.isLoading = false;
      this.$root.$emit('bv::hide::modal', 'yesterdaily');
```
Sequence on the wire:
1. `POST /api/v4/tasks/bulk-score` with `[{id, direction:'up'}, ...]` for the ticked ones
   (`website/server/controllers/api-v4/tasks.js:53-68`; body validated in `scoreTasks`,
   `libs/tasks/index.js`). Each is a normal "up" score: `completed = true`, `streak += 1`, history
   entry `{completed: true}`, value up. Scoring an already-completed daily "up" is rejected with
   `sessionOutdated` (`libs/tasks/index.js:426`).
2. `POST /api/v4/cron`. Because the ticked dailies are now `completed`, cron doesn't penalise them;
   it resets `completed` to false and clears their checklists. Unticked due ones get the miss
   penalty and `streak = 0`.
3. Refetch user + tasks.

Streak semantics that fall out of this: streak is incremented when you check, reset to 0 by cron if
a due daily is unchecked at rollover, and never touched by cron for not-due days (so "every Monday"
streaks count Mondays).

---

## 6. Todos

Schema (`task.js:415-419`):
```js
export const TodoSchema = new Schema(_.defaults({
  dateCompleted: Date,
  date: Date, // due date for todos
}, dailyTodoSchema()), subDiscriminatorOptions);
```

- `date` (due date) has **no server-side behaviour**: cron ignores it, scoring ignores it. It only
  drives client display and the "scheduled" filter/sort.
- Client "overdue" styling (`website/client/src/components/tasks/task.vue:1120-1134`):
  ```js
    calculateTimeTillDue () {
      const endOfToday = moment().subtract(this.user.preferences.dayStart, 'hours').endOf('day');
      const endOfDueDate = moment(this.task.date).endOf('day');

      return moment.duration(endOfDueDate.diff(endOfToday));
    },
    checkIfOverdue () {
      return this.calculateTimeTillDue().asDays() < 0;
    },
    formatDueDate () {
      if (moment().isSame(this.task.date, 'day')) {
        return this.$t('today');
      }
      return moment(this.task.date).format(this.user.preferences.dateFormat.toUpperCase());
    },
  ```
  i.e. overdue when the due date's calendar day is before the current CDS day (browser zone).
- `dateCompleted` (`scoreTask.js:406-412`): set to `new Date()` on up, `undefined` on down:
  ```js
        } else {
          task.dateCompleted = new Date();
          task.completed = true;
        }
      } else if (direction === 'down') {
        task.completed = false;
        task.dateCompleted = undefined;
  ```
- Completed todos are removed from `user.tasksOrder.todos` on completion (`libs/tasks/index.js:
  486-500`, `pullTask`) and re-added on un-completion; cron also prunes (`cron.js:322-325`).
- Default task fetch **excludes** completed todos (`libs/tasks/index.js:244-251`). The "Complete"
  column loads them separately: `GET /api/v4/tasks/user?type=completedTodos`
  (`website/client/src/store/actions/tasks.js:27-38`); server (`libs/tasks/index.js:205-227`):
  `limit = 0` (no limit; the apidoc's "30 most recently completed" at `controllers/api-v3/tasks.js:
  347-348` is stale), sorted `dateCompleted: -1`.
- Archival: completed todos are **deleted** by `cronWrapper` when `dateCompleted` is older than 30
  days (90 for subscribers), excluding challenge/group todos (`cron.js:441-453`, quoted in 4.2).
  Runs only when cron actually runs (`daysMissed > 0`).
- Value decay: every uncompleted todo is scored down once per cron (section 4.3), so they "get
  redder". No decay for completed todos.
- `user.history.todos`: one `{date, value: Σ uncompleted todo values}` entry per cron.

---

## 7. Habits

Schema (`task.js:369-375`):
```js
export const HabitSchema = new Schema(_.defaults({
  up: { $type: Boolean, default: true },
  down: { $type: Boolean, default: true },
  counterUp: { $type: Number, default: 0 },
  counterDown: { $type: Number, default: 0 },
  frequency: { $type: String, default: 'daily', enum: ['daily', 'weekly', 'monthly'] },
}, habitDailySchema()), subDiscriminatorOptions);
```
Client defaults (`taskDefaults.js:59-66`): `up: true, down: true, frequency: 'daily', counterUp: 0,
counterDown: 0`. Counters are user-editable in the modal (`taskModal.vue:623`) and shown on the card
as `+N` / `−N` (`task.vue:270-292`).

Scoring (`scoreTask.js:204-210`, called at `:304`):
```js
function _updateCounter (task, direction, times) {
  if (direction === 'up') {
    task.counterUp += times;
  } else {
    task.counterDown += times;
  }
}
```
Habit history: one entry per CDS day; if the last entry is "today" (CDS-adjusted, `:212-225`) it is
updated in place (`value`, `date`, `scoredUp += times` / `scoredDown += times`, `:227-241`), else a
new `{date, value, scoredUp, scoredDown}` is pushed (`:296-301`).

Cron (`website/server/libs/cron.js:69-100`), verbatim:
```js
function processHabits (user, habits, now, daysMissed) {
  // check if we've passed a day on which we should reset the habit counters, including today
  const nowMoment = moment(now)
    .utcOffset(user.getUtcOffset() - user.preferences.dayStart * 60);
  const thatDay = nowMoment.clone()
    .subtract({ days: daysMissed });
  const resetWeekly = nowMoment.isoWeek() !== thatDay.isoWeek();
  const resetMonthly = nowMoment.month() !== thatDay.month();

  habits.forEach(task => {
    // reset counters if appropriate

    let reset = false;
    if (task.frequency === 'daily') {
      reset = true;
    } else if (task.frequency === 'weekly' && resetWeekly === true) {
      reset = true;
    } else if (task.frequency === 'monthly' && resetMonthly === true) {
      reset = true;
    }
    if (reset === true) {
      task.counterUp = 0;
      task.counterDown = 0;
    }

    // slowly reset value to 0 for "onlies" (Habits with + or - but not both)
    // move singleton Habits towards yellow.
    if (task.up === false || task.down === false) {
      task.value = Math.abs(task.value) < 0.1 ? 0 : task.value /= 2;
    }
  });
}
```
Semantics:
- Time base: `now` in the user's offset **shifted back by `dayStart` hours** (offset −
  `dayStart*60` min), so calendar-day/week/month boundaries fall at the CDS. `thatDay = now −
  daysMissed days` in that frame.
- `daily`: counters reset on every cron.
- `weekly`: reset iff the **ISO week** (Monday-start, locale-independent) of `now` differs from that
  of `thatDay`. Test names: "should reset a weekly habit counter each Monday" (`test/api/unit/libs/
  cron.test.js:932`), plus the server-TZ vs user-TZ cases at `:993-1075`.
- `monthly`: reset iff `month()` differs (year is *not* compared; a gap of exactly 12 months would
  not reset — practically irrelevant).
- Resets happen regardless of `preferences.sleep` (test `:919`).
- Value decay applies **only to one-sided habits** (`up === false || down === false`): halve toward
  0 each cron (not per missed day); snap to 0 when `|value| < 0.1`. Two-sided habits never decay
  (test `:887`). The odd `task.value /= 2` inside the ternary is just an assignment expression.

---

## 8. Client column filters (exact predicates)

`website/client/src/libs/store/helpers/filterTasks.js:5-38`:
```js
const taskFilters = {
  habit: {
    label: 'habits',
    filters: [
      { label: 'all', filterFn: () => true, default: true },
      { label: 'yellowred', filterFn: t => t.value < 1 }, // weak
      { label: 'greenblue', filterFn: t => t.value >= 1 }, // strong
    ],
  },
  daily: {
    label: 'dailies',
    filters: [
      { label: 'all', filterFn: () => true, default: true },
      { label: 'due', filterFn: t => !t.completed && t.isDue },
      { label: 'notDue', filterFn: t => t.completed || !t.isDue },
    ],
  },
  todo: {
    label: 'todos',
    filters: [
      { label: 'remaining', filterFn: t => !t.completed, default: true }, // active
      { label: 'scheduled', filterFn: t => !t.completed && t.date, sort: t => t.date },
      { label: 'complete2', filterFn: t => t.completed },
    ],
  },
  reward: { ... },
};
```
Labels → UI strings (`website/common/locales/en/tasks.json`): `yellowred` = "Weak", `greenblue` =
"Strong", `remaining` = "Active", `scheduled` = "Scheduled", `complete2` = "Complete", `notDue` =
"Not Due". "Due" uses the persisted `task.isDue` (section 3.2), not a live `shouldDo`.

Applying (`filterTasks.js:108-114`): filter, then `sortBy(sort)` when the filter defines `sort`
(only `scheduled` → ascending by due date); otherwise the user's manual `tasksOrder` is kept
(`getters/tasks.js:230-249`). Drag-and-drop is disabled while `scheduled` is active
(`column.vue:89`).

The chosen filter per column is persisted in `user.preferences.tasks.activeFilter.{habit,daily,todo,
reward}` (schema `user/schema.js:642-647`, defaults `all/all/remaining/all`) and restored on load
(`column.vue:513`, `:680-685`). Selecting "Complete" triggers the separate completed-todos fetch
(`column.vue:660-667`).

Task colour bands from value (`getters/tasks.js:23-42`): `< -20` worst, `< -10` worse, `< -1` bad,
`< 1` neutral, `< 5` good, `< 10` better, else best.

Checkbox greyed ("not due" look) when `task.completed || !shouldDo(dueDate || now, task, prefs)`
(`getters/tasks.js:172-186`).

---

## 9. Task defaults and start-date normalisation

Client-side defaults (`website/common/script/libs/taskDefaults.js:69-99`):
```js
  if (task.type === 'daily') {
    const now = moment().utcOffset(getUtcOffset(user));
    const startOfDay = now.clone().startOf('day');
    const startOfDayWithCDSTime = startOfDay
      .clone()
      .add({
        hours: user.preferences.dayStart,
      });

    defaults(task, {
      streak: 0,
      repeat: {
        m: true,
        t: true,
        w: true,
        th: true,
        f: true,
        s: true,
        su: true,
      },
      // If cron will happen today, start the daily yesterday
      startDate: startOfDayWithCDSTime.isAfter(now)
        ? startOfDay.clone().subtract(1, 'day').toDate()
        : startOfDay.toDate(),
      everyX: 1,
      frequency: 'weekly',
      daysOfMonth: [],
      weeksOfMonth: [],
      yesterDaily: true,
    });
  }
```
Default daily = weekly, every day, everyX 1, startDate = current CDS day at 00:00 in the user's
offset (i.e. yesterday's calendar date if before CDS).

Server normalisation on create and update (`website/server/libs/tasks/utils.js:62-75`):
```js
export function normalizeDailyStartDate (date, user) {
  if (!date) return date;
  const utcView = moment.utc(date);
  const looksLikeMidnightLocal = utcView.second() === 0
    && utcView.millisecond() === 0
    && [0, 15, 30, 45].includes(utcView.minute());
  if (looksLikeMidnightLocal) {
    return new Date(date);
  }
  return moment(date)
    .utcOffset(-(user.preferences.timezoneOffset || 0))
    .startOf('day')
    .toDate();
}
```
Heuristic: if the instant looks like "some local midnight" (seconds 0, minutes ∈ {0,15,30,45}) keep
it; otherwise snap to 00:00 of that date in the user's offset.

Update-time monthly re-alignment (`controllers/api-v3/tasks.js:653-675`):
```js
    if (task.type === 'daily'
        && task.startDate
    ) {
      task.startDate = normalizeDailyStartDate(task.startDate, user);

      // If the daily task was set to repeat monthly on a day of the month, and the start date was
      // updated, the task will then need to be updated to repeat on the same day of the month as
      // the new start date. ...
      if (
        task.frequency === 'monthly'
        && task.daysOfMonth.length
      ) {
        task.daysOfMonth = [moment(task.startDate).utcOffset(
          -user.preferences.timezoneOffset,
        ).date()];
      }
      if (task.streak === undefined) task.streak = 0;
      task.streak = Math.trunc(task.streak);
    }
```
So for `daysOfMonth` mode the server forces a **single** day = startDate's day-of-month.

Client modal derives the monthly arrays from `startDate` (`taskModal.vue:1607-1628`):
```js
      if (task.frequency === 'monthly') {
        if (repeatsOn === 'dayOfMonth') {
          const date = moment(task.startDate).date();
          task.weeksOfMonth = [];
          task.daysOfMonth = [date];
        } else if (repeatsOn === 'dayOfWeek') {
          const week = Math.ceil(moment(task.startDate).date() / 7) - 1;
          const dayOfWeek = moment(task.startDate).day();
          const shortDay = this.dayMapping[dayOfWeek];
          task.daysOfMonth = [];
          task.weeksOfMonth = [week];
          for (const key of Object.keys(task.repeat)) {
            task.repeat[key] = false;
          }
          task.repeat[shortDay] = true;
        }
      }
```
UI choice is a radio `repeatsOn ∈ {dayOfMonth, dayOfWeek}`; "dayOfWeek" = "the Nth <weekday of
startDate> of the month" with `weeksOfMonth = [ceil(date/7) − 1]` (0-indexed, matches
`monthWeekByDay`). `weeksOfMonth[0] === 4` shows `fifthWeekWarning` ("This task will not appear due
during months with fewer <day>s"). Recomputed whenever `startDate` or `frequency` changes
(`taskModal.vue:1560-1565`).

`common/script/ops/updateTask.js:25-32` ensures empty arrays sent by the client actually clear the
fields (lodash `merge` would otherwise keep old values).

Task history `yesterDaily` flag is not exposed in the web modal (grep: only `notifications.vue`);
it is API/mobile-only.

---

## 10. Gamification stripped from cron (for the record)

From `cron()` (`libs/cron.js:150-387`) and `scoreTask`, dropped:
- `items.lastDrop.count` reset (`:159`); random drops on scoring.
- "Perfect day": `perfect` flag, `achievements.perfect`, `stats.buffs` (str/int/per/con/stealth/
  streaks) set or cleared (`:161`, `:332-352`).
- Gems cap reset / subscription month perks / terminated subscription cleanup (`:164-179`).
- Login incentives (`:181-183`, `awardLoginIncentives`).
- HP damage for missed dailies (`_subtractPoints`), `stats.buffs.stealth` evasion (`:242-245`),
  quest boss damage `party.quest.progress.down` (`:277-286`), `CRON_SAFE_MODE` /
  `CRON_SEMI_SAFE_MODE` env switches.
- MP regeneration weighted by `dailyChecked / (dailyDueUnchecked + dailyChecked)` (`:356-366`),
  including the fractional checklist accounting (`:258-266`).
- EXP tally history `user.history.exp` (`:312-320`).
- `party.quest.progress` reset and `Group.processQuestProgress` (`:367-374`, `:497`).
- Debuff potions, pinned items cleanup (`:354`, `:376-378`), `UserHistory` audit (`:382-384`).
- In `scoreTask`: crits, gold/exp, streak bonus gold, stat training, quest progress up, MP gain,
  streak achievements at multiples of 21, onboarding achievements.
- `preferences.sleep` (Inn): its only cron effects are "skip the miss penalty (value + streak
  reset)" and "skip MP gain"; counters, `completed`, checklist, `isDue`, history are unaffected.

---

## 11. Quirks / bugs to decide on before reimplementing

1. `daysUserHasMissed` reads `auth.timestamps.loggedIn` but the field is `loggedin` → the "use
   login time if earlier than lastCron" branch never fires (`methods.js:398-400`).
2. `shouldDo` mutates its `startOfDayWithCDSTime` via `.startOf('day')` at `cron.js:127`; all nextDue
   comparisons are against 00:00 of the CDS day, not the CDS hour.
3. Weekly `everyX > 1` uses a truncated 7-day count from `startDate` (`diff(..., 'week')`), not
   calendar weeks; the weekly `nextDue` generator uses Sun–Sat calendar weeks of `startDate`. They
   disagree when startDate isn't a Sunday.
4. Monthly with both `daysOfMonth` and `weeksOfMonth` empty is due every day (no recur rules).
5. Monthly `nextDue`/`weeksOfMonth` loop has no iteration cap (potential infinite loop on bad data).
6. Yearly uses a fractional year diff; Feb 29 starts only recur in leap years.
7. `daysOfMonth` end-of-month clamp: `[31]` is due on the last day of shorter months
   (`moment-recur.js:164-171`).
8. Habit monthly counter reset compares `month()` only, not year.
9. `multiDaysCountAsOneDay = true` hard-codes "only yesterday matters": after N days away only one
   penalty per daily, and due-ness is checked for `now − 24h` only.
10. `isDue`/`nextDue` are persisted snapshots; the "Due" filter can be stale until cron runs. The
    checkbox appearance uses live `shouldDo`.
11. Client yesterdailies uses calendar-yesterday + dayStart; server cron uses `now − 24h`
    CDS-adjusted. Differ when the user is active between midnight and CDS.
12. `sanitizeOptions` accepts `dayStart` up to 24; schema caps at 23; user pre-save hook resets
    invalid to 0.
13. `timezoneOffset` uses the inverted (legacy `getTimezoneOffset`) sign; every consumer negates it.
14. Changing CDS (`POST /user/custom-day-start`) sets `lastCron = now`.
15. Cron lock `_cronSignature` is a ms timestamp; stale locks are overridable after 5 minutes;
    `CRON_ALREADY_RUNNING` errors surface to the client as a failed `/cron` request.
16. The apidoc says `completedTodos` returns the 30 most recent; the code sets `limit = 0` (all,
    bounded only by the 30/90-day deletion at cron).

Conformance tests worth porting: `test/common/shouldDo.test.js` (1200+ lines covering every
frequency × CDS × start-date case), `test/common/libs/cron.test.js` (`startOfDay`, `daysSince`),
`test/api/unit/libs/cron.test.js` (`todos`, `dailys`, `habits`/`counters` sections at `:528-1130`).
