import { DateTime } from 'luxon';
import {
  addDays,
  daysDiff,
} from '@karotto/core/civil';
import type { IsoDate } from '@karotto/core/civil';

export type DayContext = {
  timezone: string;
  dayStart: number;
};

export type Instant = Date | string | number;

export function toDateTime(
  instant: Instant,
  timezone: string,
): DateTime {
  if (instant instanceof Date) {
    return DateTime.fromJSDate(
      instant,
      { zone: timezone },
    );
  }
  if (typeof instant === 'number') {
    return DateTime.fromMillis(
      instant,
      { zone: timezone },
    );
  }
  return DateTime.fromISO(
    instant,
    { zone: timezone },
  );
}

export function isValidTimezone(timezone: string): boolean {
  return DateTime.local({ zone: timezone }).isValid;
}

export function cdsDay(
  instant: Instant,
  ctx: DayContext,
): IsoDate {
  const local = toDateTime(
    instant,
    ctx.timezone,
  );
  if (!local.isValid) {
    throw new RangeError(`Invalid instant or timezone: ${String(instant)} ${ctx.timezone}`);
  }
  const date = local.toISODate() as IsoDate;
  return local.hour < ctx.dayStart
    ? addDays(
        date,
        -1,
      )
    : date;
}

export function startOfCdsDay(
  instant: Instant,
  ctx: DayContext,
): DateTime {
  return DateTime.fromISO(
    cdsDay(
      instant,
      ctx,
    ),
    { zone: ctx.timezone },
  ).plus({ hours: ctx.dayStart });
}

export function nextCdsBoundary(
  instant: Instant,
  ctx: DayContext,
): DateTime {
  return startOfCdsDay(
    instant,
    ctx,
  ).plus({ days: 1 });
}

export function daysBetween(
  from: Instant,
  to: Instant,
  ctx: DayContext,
): number {
  return daysDiff(
    cdsDay(
      from,
      ctx,
    ),
    cdsDay(
      to,
      ctx,
    ),
  );
}

export function isSameCdsDay(
  a: Instant,
  b: Instant,
  ctx: DayContext,
): boolean {
  return cdsDay(
    a,
    ctx,
  ) === cdsDay(
    b,
    ctx,
  );
}
