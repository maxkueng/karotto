export type IsoDate = string;

export type CivilDate = {
  year: number;
  month: number;
  day: number;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MS_PER_DAY = 86_400_000;

export function parseIsoDate(value: string): CivilDate | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(
    year,
    month,
  )) {
    return null;
  }
  return {
    year,
    month,
    day,
  };
}

export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

function pad(
  value: number,
  width: number,
): string {
  return String(value).padStart(
    width,
    '0',
  );
}

export function formatIsoDate(date: CivilDate): IsoDate {
  return `${pad(
    date.year,
    4,
  )}-${pad(
    date.month,
    2,
  )}-${pad(
    date.day,
    2,
  )}`;
}

function assertDate(value: IsoDate): CivilDate {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }
  return parsed;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(
  year: number,
  month: number,
): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [
    4,
    6,
    9,
    11,
  ].includes(month)
    ? 30
    : 31;
}

export function toEpochDay(value: IsoDate): number {
  const date = assertDate(value);
  return Date.UTC(
    date.year,
    date.month - 1,
    date.day,
  ) / MS_PER_DAY;
}

export function fromEpochDay(epochDay: number): IsoDate {
  const date = new Date(epochDay * MS_PER_DAY);
  return formatIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function addDays(
  value: IsoDate,
  days: number,
): IsoDate {
  return fromEpochDay(toEpochDay(value) + days);
}

export function daysDiff(
  from: IsoDate,
  to: IsoDate,
): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function compareIsoDates(
  a: IsoDate,
  b: IsoDate,
): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function weekday(value: IsoDate): number {
  return new Date(toEpochDay(value) * MS_PER_DAY).getUTCDay();
}

export function dayOfMonth(value: IsoDate): number {
  return assertDate(value).day;
}

export function isLastDayOfMonth(value: IsoDate): boolean {
  const date = assertDate(value);
  return date.day === daysInMonth(
    date.year,
    date.month,
  );
}

export function monthIndex(value: IsoDate): number {
  const date = assertDate(value);
  return date.year * 12 + (date.month - 1);
}

export function monthsDiff(
  from: IsoDate,
  to: IsoDate,
): number {
  return monthIndex(to) - monthIndex(from);
}

export function addMonthsClamped(
  value: IsoDate,
  months: number,
): IsoDate {
  const date = assertDate(value);
  const index = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return formatIsoDate({
    year,
    month,
    day: Math.min(
      date.day,
      daysInMonth(
        year,
        month,
      ),
    ),
  });
}

export function firstOfMonth(value: IsoDate): IsoDate {
  const date = assertDate(value);
  return formatIsoDate({
    year: date.year,
    month: date.month,
    day: 1,
  });
}

export function yearOf(value: IsoDate): number {
  return assertDate(value).year;
}

export type IsoWeek = {
  year: number;
  week: number;
};

export function isoWeek(value: IsoDate): IsoWeek {
  const date = new Date(toEpochDay(value) * MS_PER_DAY);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = Date.UTC(
    year,
    0,
    1,
  );
  const week = Math.ceil(((date.getTime() - yearStart) / MS_PER_DAY + 1) / 7);
  return {
    year,
    week,
  };
}
