import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  cdsDay,
  daysBetween,
  isValidTimezone,
  startOfCdsDay,
} from '@karotto/core/time';

const zurich = {
  timezone: 'Europe/Zurich',
  dayStart: 0,
};

describe(
  'cdsDay',
  () => {
    it(
      'uses the calendar date in the user zone',
      () => {
        expect(cdsDay(
          new Date('2020-02-02T09:30:00Z'),
          {
            timezone: 'UTC',
            dayStart: 0,
          },
        )).toBe('2020-02-02');
        expect(cdsDay(
          new Date('2020-02-01T23:30:00Z'),
          zurich,
        )).toBe('2020-02-02');
      },
    );

    it(
      'moves instants before day start to the previous day',
      () => {
        const ctx = {
          timezone: 'UTC',
          dayStart: 5,
        };
        expect(cdsDay(
          new Date('2020-02-02T04:30:00Z'),
          ctx,
        )).toBe('2020-02-01');
        expect(cdsDay(
          new Date('2020-02-02T05:00:00Z'),
          ctx,
        )).toBe('2020-02-02');
      },
    );

    it(
      'respects timezone when applying day start',
      () => {
        const ctx = {
          timezone: 'Etc/GMT-2',
          dayStart: 5,
        };
        expect(cdsDay(
          new Date('2020-02-02T04:30:00Z'),
          ctx,
        )).toBe('2020-02-02');
      },
    );

    it(
      'handles DST transitions without duplicating or skipping days',
      () => {
        const ctx = {
          timezone: 'Europe/Zurich',
          dayStart: 2,
        };
        const beforeSwitch = new Date('2026-03-29T00:30:00Z');
        const afterSwitch = new Date('2026-03-29T01:30:00Z');
        expect(cdsDay(
          beforeSwitch,
          ctx,
        )).toBe('2026-03-28');
        expect(cdsDay(
          afterSwitch,
          ctx,
        )).toBe('2026-03-29');
      },
    );
  },
);

describe(
  'startOfCdsDay',
  () => {
    it(
      'is dayStart o clock on the CDS day',
      () => {
        const ctx = {
          timezone: 'UTC',
          dayStart: 5,
        };
        expect(startOfCdsDay(
          new Date('2020-02-02T04:30:00Z'),
          ctx,
        ).toISO()).toBe('2020-02-01T05:00:00.000Z');
        expect(startOfCdsDay(
          new Date('2020-02-02T09:30:00Z'),
          ctx,
        ).toISO()).toBe('2020-02-02T05:00:00.000Z');
      },
    );
  },
);

describe(
  'daysBetween',
  () => {
    it(
      'counts day boundaries crossed',
      () => {
        expect(daysBetween(
          new Date('2020-02-02T09:30:00Z'),
          new Date('2020-02-04T09:30:00Z'),
          zurich,
        )).toBe(2);
      },
    );

    it(
      'is one lower if now is before dayStart',
      () => {
        const ctx = {
          timezone: 'UTC',
          dayStart: 6,
        };
        expect(daysBetween(
          new Date('2020-02-01T13:00:00Z'),
          new Date('2020-02-08T03:00:00Z'),
          ctx,
        )).toBe(6);
      },
    );

    it(
      'is one higher if reference is before dayStart and now after',
      () => {
        const ctx = {
          timezone: 'UTC',
          dayStart: 11,
        };
        expect(daysBetween(
          new Date('2020-02-01T08:00:00Z'),
          new Date('2020-02-08T17:00:00Z'),
          ctx,
        )).toBe(8);
      },
    );
  },
);

describe(
  'isValidTimezone',
  () => {
    it(
      'accepts IANA zones and rejects garbage',
      () => {
        expect(isValidTimezone('Europe/Zurich')).toBe(true);
        expect(isValidTimezone('UTC')).toBe(true);
        expect(isValidTimezone('Mars/Olympus')).toBe(false);
      },
    );
  },
);
