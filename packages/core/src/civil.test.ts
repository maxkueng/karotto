import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  addDays,
  addMonthsClamped,
  daysDiff,
  isoWeek,
  monthsDiff,
  parseIsoDate,
  weekday,
} from '@karotto/core/civil';

describe(
  'civil dates',
  () => {
    it(
      'parses and rejects dates',
      () => {
        expect(parseIsoDate('2024-02-29')).toEqual({
          year: 2024,
          month: 2,
          day: 29,
        });
        expect(parseIsoDate('2023-02-29')).toBeNull();
        expect(parseIsoDate('2023-13-01')).toBeNull();
        expect(parseIsoDate('2023-1-01')).toBeNull();
      },
    );

    it(
      'adds and diffs days across month and year boundaries',
      () => {
        expect(addDays(
          '2023-12-31',
          1,
        )).toBe('2024-01-01');
        expect(addDays(
          '2024-03-01',
          -1,
        )).toBe('2024-02-29');
        expect(daysDiff(
          '2017-11-19',
          '2018-01-21',
        )).toBe(63);
      },
    );

    it(
      'computes weekdays with Sunday as 0',
      () => {
        expect(weekday('2026-09-28')).toBe(1);
        expect(weekday('2017-11-19')).toBe(0);
      },
    );

    it(
      'clamps day of month when adding months',
      () => {
        expect(addMonthsClamped(
          '2024-01-31',
          1,
        )).toBe('2024-02-29');
        expect(addMonthsClamped(
          '2024-05-31',
          -1,
        )).toBe('2024-04-30');
        expect(monthsDiff(
          '2017-05-01',
          '2018-02-01',
        )).toBe(9);
      },
    );

    it(
      'computes ISO weeks',
      () => {
        expect(isoWeek('2021-01-03')).toEqual({
          year: 2020,
          week: 53,
        });
        expect(isoWeek('2021-01-04')).toEqual({
          year: 2021,
          week: 1,
        });
        expect(isoWeek('2026-09-27')).toEqual({
          year: 2026,
          week: 39,
        });
        expect(isoWeek('2026-09-28')).toEqual({
          year: 2026,
          week: 40,
        });
      },
    );
  },
);
