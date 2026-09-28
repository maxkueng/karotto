import {
  cdsDay,
  parseIsoDate,
} from '@karotto/core';
import type {
  DateFormat,
  DayContext,
  IsoDate,
} from '@karotto/core';

export function formatIsoDate(
  iso: IsoDate,
  format: DateFormat,
): string {
  const date = parseIsoDate(iso);
  if (!date) {
    return iso;
  }
  const dd = String(date.day).padStart(
    2,
    '0',
  );
  const mm = String(date.month).padStart(
    2,
    '0',
  );
  const yyyy = String(date.year);
  return format
    .replace(
      'yyyy',
      yyyy,
    )
    .replace(
      'MM',
      mm,
    )
    .replace(
      'dd',
      dd,
    );
}

export function todayIso(ctx: DayContext): IsoDate {
  return cdsDay(
    new Date(),
    ctx,
  );
}

export function isOverdue(
  dueDate: IsoDate,
  ctx: DayContext,
): boolean {
  return dueDate < todayIso(ctx);
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? '';
}

export const WEEKDAY_LABELS = [
  'Su',
  'Mo',
  'Tu',
  'We',
  'Th',
  'Fr',
  'Sa',
];

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function longDate(iso: IsoDate): string {
  const date = parseIsoDate(iso);
  if (!date) {
    return iso;
  }
  return `${monthName(date.month)} ${ordinal(date.day)}`;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
