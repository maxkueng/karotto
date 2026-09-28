import {
  addDays,
  addMonthsClamped,
  compareIsoDates,
  dayOfMonth,
  daysDiff,
  daysInMonth,
  firstOfMonth,
  formatIsoDate,
  isLastDayOfMonth,
  monthsDiff,
  parseIsoDate,
  weekday,
  yearOf,
} from '@karotto/core/civil';
import type { IsoDate } from '@karotto/core/civil';
import { repeatDayKeys } from '@karotto/core/schemas/task';
import type {
  Daily,
  Repeat,
} from '@karotto/core/schemas/task';
import { cdsDay } from '@karotto/core/time';
import type {
  DayContext,
  Instant,
} from '@karotto/core/time';

export type Schedule = Pick<
  Daily,
  'frequency' | 'everyX' | 'startDate' | 'repeat' | 'daysOfMonth' | 'weeksOfMonth'
>;

const MAX_EVERY_X = 9999;

function enabledWeekdays(repeat: Repeat): number[] {
  const days: number[] = [];
  repeatDayKeys.forEach((
    key,
    index,
  ) => {
    if (repeat[key]) {
      days.push(index);
    }
  });
  return days;
}

export function weekOfMonthByDay(day: IsoDate): number {
  return Math.floor((dayOfMonth(day) - 1) / 7);
}

function matchesDayOfMonth(
  day: IsoDate,
  daysOfMonth: number[],
): boolean {
  const date = dayOfMonth(day);
  if (daysOfMonth.includes(date)) {
    return true;
  }
  if (!isLastDayOfMonth(day)) {
    return false;
  }
  return daysOfMonth.some((listed) => listed > date);
}

export function shouldDo(
  day: IsoDate,
  task: Schedule,
): boolean {
  if (!Number.isInteger(task.everyX) || task.everyX < 1 || task.everyX > MAX_EVERY_X) {
    return false;
  }
  if (compareIsoDates(
    day,
    task.startDate,
  ) < 0) {
    return false;
  }

  switch (task.frequency) {
    case 'daily':
      return daysDiff(
        task.startDate,
        day,
      ) % task.everyX === 0;

    case 'weekly': {
      const days = enabledWeekdays(task.repeat);
      if (days.length === 0 || !days.includes(weekday(day))) {
        return false;
      }
      const weeks = Math.floor(daysDiff(
        task.startDate,
        day,
      ) / 7);
      return weeks % task.everyX === 0;
    }

    case 'monthly': {
      const months = monthsDiff(
        firstOfMonth(task.startDate),
        firstOfMonth(day),
      );
      if (months % task.everyX !== 0) {
        return false;
      }
      if (task.weeksOfMonth.length > 0) {
        const days = enabledWeekdays(task.repeat);
        return days.includes(weekday(day)) && task.weeksOfMonth.includes(weekOfMonthByDay(day));
      }
      if (task.daysOfMonth.length > 0) {
        return matchesDayOfMonth(
          day,
          task.daysOfMonth,
        );
      }
      return false;
    }

    case 'yearly': {
      const start = parseIsoDate(task.startDate);
      const current = parseIsoDate(day);
      if (!start || !current) {
        return false;
      }
      if (start.month !== current.month || start.day !== current.day) {
        return false;
      }
      return (current.year - start.year) % task.everyX === 0;
    }
  }
}

export function isDueOn(
  instant: Instant,
  task: Schedule,
  ctx: DayContext,
): boolean {
  return shouldDo(
    cdsDay(
      instant,
      ctx,
    ),
    task,
  );
}

function* candidateDays(
  after: IsoDate,
  task: Schedule,
): Generator<IsoDate> {
  const start = compareIsoDates(
    task.startDate,
    after,
  ) > 0
    ? task.startDate
    : addDays(
        after,
        1,
      );
  switch (task.frequency) {
    case 'daily': {
      const offset = daysDiff(
        task.startDate,
        start,
      );
      const remainder = ((offset % task.everyX) + task.everyX) % task.everyX;
      let day = addDays(
        start,
        remainder === 0 ? 0 : task.everyX - remainder,
      );
      for (;;) {
        yield day;
        day = addDays(
          day,
          task.everyX,
        );
      }
    }
    case 'weekly': {
      let day = start;
      for (;;) {
        yield day;
        day = addDays(
          day,
          1,
        );
      }
    }
    case 'monthly': {
      let month = firstOfMonth(start);
      for (;;) {
        const parsed = parseIsoDate(month);
        if (!parsed) {
          return;
        }
        const total = daysInMonth(
          parsed.year,
          parsed.month,
        );
        for (let d = 1; d <= total; d += 1) {
          const day = formatIsoDate({
            year: parsed.year,
            month: parsed.month,
            day: d,
          });
          if (compareIsoDates(
            day,
            start,
          ) >= 0) {
            yield day;
          }
        }
        month = addMonthsClamped(
          month,
          1,
        );
      }
    }
    case 'yearly': {
      const startParsed = parseIsoDate(task.startDate);
      if (!startParsed) {
        return;
      }
      let year = yearOf(start);
      for (;;) {
        if (startParsed.day <= daysInMonth(
          year,
          startParsed.month,
        )) {
          const day = formatIsoDate({
            year,
            month: startParsed.month,
            day: startParsed.day,
          });
          if (compareIsoDates(
            day,
            start,
          ) >= 0) {
            yield day;
          }
        }
        year += 1;
      }
    }
  }
}

const CANDIDATE_LIMIT = 200_000;

export function nextDueDates(
  after: IsoDate,
  task: Schedule,
  count = 6,
): IsoDate[] {
  const result: IsoDate[] = [];
  if (!Number.isInteger(task.everyX) || task.everyX < 1 || task.everyX > MAX_EVERY_X) {
    return result;
  }
  let inspected = 0;
  for (const day of candidateDays(
    after,
    task,
  )) {
    inspected += 1;
    if (inspected > CANDIDATE_LIMIT) {
      break;
    }
    if (shouldDo(
      day,
      task,
    )) {
      result.push(day);
      if (result.length >= count) {
        break;
      }
    }
  }
  return result;
}

export function yesterdayOf(
  instant: Instant,
  ctx: DayContext,
): IsoDate {
  return addDays(
    cdsDay(
      instant,
      ctx,
    ),
    -1,
  );
}

export function yesterdailies<T extends Pick<Daily, 'completed' | 'yesterdaily'> & Schedule>(
  dailies: T[],
  instant: Instant,
  ctx: DayContext,
): T[] {
  const yesterday = yesterdayOf(
    instant,
    ctx,
  );
  return dailies.filter((daily) => !daily.completed && daily.yesterdaily && shouldDo(
    yesterday,
    daily,
  ));
}
