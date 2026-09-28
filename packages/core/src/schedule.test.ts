import {
  describe,
  expect,
  it,
} from 'vitest';
import { addDays } from '@karotto/core/civil';
import {
  isDueOn,
  nextDueDates,
  shouldDo,
  yesterdailies,
} from '@karotto/core/schedule';
import type { Schedule } from '@karotto/core/schedule';
import { everyDay } from '@karotto/core/schemas/task';
import type { Repeat } from '@karotto/core/schemas/task';

const none: Repeat = {
  su: false,
  m: false,
  t: false,
  w: false,
  th: false,
  f: false,
  s: false,
};

function daily(overrides: Partial<Schedule> = {}): Schedule {
  return {
    frequency: 'weekly',
    everyX: 1,
    startDate: '2017-05-01',
    repeat: everyDay,
    daysOfMonth: [],
    weeksOfMonth: [],
    ...overrides,
  };
}

describe(
  'shouldDo',
  () => {
    it(
      'is never due before the start date',
      () => {
        expect(shouldDo(
          '2017-04-30',
          daily(),
        )).toBe(false);
        expect(shouldDo(
          '2017-05-01',
          daily(),
        )).toBe(true);
      },
    );

    it(
      'is never due with an invalid everyX',
      () => {
        expect(shouldDo(
          '2017-05-01',
          daily({ everyX: 0 }),
        )).toBe(false);
        expect(shouldDo(
          '2017-05-01',
          daily({ everyX: 10000 }),
        )).toBe(false);
      },
    );

    describe(
      'every X days',
      () => {
        it(
          'is due on multiples of X from the start date',
          () => {
            const task = daily({
              frequency: 'daily',
              everyX: 2,
            });
            expect(shouldDo(
              '2017-05-01',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-05-02',
              task,
            )).toBe(false);
            expect(shouldDo(
              '2017-05-03',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-05-08',
              daily({
                frequency: 'daily',
                everyX: 7,
              }),
            )).toBe(true);
          },
        );

        it(
          'computes next due dates',
          () => {
            expect(nextDueDates(
              '2017-05-01',
              daily({
                frequency: 'daily',
                everyX: 2,
              }),
            )).toEqual([
              '2017-05-03',
              '2017-05-05',
              '2017-05-07',
              '2017-05-09',
              '2017-05-11',
              '2017-05-13',
            ]);
          },
        );
      },
    );

    describe(
      'weekly',
      () => {
        it(
          'is never due with no weekdays enabled',
          () => {
            const task = daily({ repeat: none });
            for (let i = 0; i < 7; i += 1) {
              expect(shouldDo(
                addDays(
                  '2017-05-01',
                  i,
                ),
                task,
              )).toBe(false);
            }
          },
        );

        it(
          'is due only on enabled weekdays',
          () => {
            const task = daily({
              repeat: {
                ...none,
                th: true,
              },
            });
            expect(shouldDo(
              '2017-05-04',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-05-05',
              task,
            )).toBe(false);
            expect(shouldDo(
              '2017-05-11',
              task,
            )).toBe(true);
          },
        );

        it(
          'applies every X weeks in 7-day blocks from the start date',
          () => {
            const task = daily({
              startDate: '2017-11-19',
              everyX: 3,
              repeat: {
                ...none,
                su: true,
              },
            });
            expect(shouldDo(
              '2017-11-19',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-11-26',
              task,
            )).toBe(false);
            expect(shouldDo(
              '2017-12-10',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2018-01-21',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2018-01-22',
              task,
            )).toBe(false);
          },
        );

        it(
          'computes next due dates',
          () => {
            expect(nextDueDates(
              '2017-05-01',
              daily(),
            )).toEqual([
              '2017-05-02',
              '2017-05-03',
              '2017-05-04',
              '2017-05-05',
              '2017-05-06',
              '2017-05-07',
            ]);
            const sundayFriday = daily({
              everyX: 2,
              repeat: {
                ...none,
                su: true,
                f: true,
              },
            });
            const dates = nextDueDates(
              '2017-05-01',
              sundayFriday,
            );
            expect(dates).toEqual([
              '2017-05-05',
              '2017-05-07',
              '2017-05-19',
              '2017-05-21',
              '2017-06-02',
              '2017-06-04',
            ]);
            dates.forEach((date) => expect(shouldDo(
              date,
              sundayFriday,
            )).toBe(true));
          },
        );
      },
    );

    describe(
      'monthly on days of the month',
      () => {
        it(
          'is due on listed days in matching months',
          () => {
            const task = daily({
              frequency: 'monthly',
              everyX: 2,
              startDate: '2017-05-15',
              daysOfMonth: [15],
            });
            expect(shouldDo(
              '2017-05-15',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-06-15',
              task,
            )).toBe(false);
            expect(shouldDo(
              '2017-07-15',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-07-16',
              task,
            )).toBe(false);
          },
        );

        it(
          'clamps to the last day of shorter months',
          () => {
            const task = daily({
              frequency: 'monthly',
              startDate: '2017-01-31',
              daysOfMonth: [31],
            });
            expect(shouldDo(
              '2017-02-28',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-04-30',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-04-29',
              task,
            )).toBe(false);
          },
        );

        it(
          'computes next due dates',
          () => {
            expect(nextDueDates(
              '2017-05-01',
              daily({
                frequency: 'monthly',
                everyX: 3,
                daysOfMonth: [1],
              }),
            )).toEqual([
              '2017-08-01',
              '2017-11-01',
              '2018-02-01',
              '2018-05-01',
              '2018-08-01',
              '2018-11-01',
            ]);
          },
        );

        it(
          'is never due with no rule',
          () => {
            expect(shouldDo(
              '2017-05-01',
              daily({ frequency: 'monthly' }),
            )).toBe(false);
          },
        );
      },
    );

    describe(
      'monthly on the Nth weekday',
      () => {
        it(
          'is due on the matching occurrence',
          () => {
            const task = daily({
              frequency: 'monthly',
              startDate: '2017-01-27',
              weeksOfMonth: [3],
              repeat: {
                ...none,
                f: true,
              },
            });
            expect(shouldDo(
              '2017-01-27',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2017-02-23',
              task,
            )).toBe(false);
            expect(shouldDo(
              '2017-02-24',
              task,
            )).toBe(true);
          },
        );

        it(
          'honours every X months',
          () => {
            const task = daily({
              frequency: 'monthly',
              everyX: 2,
              startDate: '2017-01-27',
              weeksOfMonth: [3],
              repeat: {
                ...none,
                f: true,
              },
            });
            expect(shouldDo(
              '2017-02-24',
              task,
            )).toBe(false);
            expect(shouldDo(
              '2017-03-24',
              task,
            )).toBe(true);
          },
        );

        it(
          'computes next due dates',
          () => {
            const firstMonday = daily({
              frequency: 'monthly',
              startDate: '2017-05-01',
              weeksOfMonth: [0],
              repeat: {
                ...none,
                m: true,
              },
            });
            expect(nextDueDates(
              '2017-05-01',
              firstMonday,
            )).toEqual([
              '2017-06-05',
              '2017-07-03',
              '2017-08-07',
              '2017-09-04',
              '2017-10-02',
              '2017-11-06',
            ]);
            const fifthMonday = daily({
              frequency: 'monthly',
              startDate: '2017-05-29',
              weeksOfMonth: [4],
              repeat: {
                ...none,
                m: true,
              },
            });
            expect(nextDueDates(
              '2017-05-29',
              fifthMonday,
            )).toEqual([
              '2017-07-31',
              '2017-10-30',
              '2018-01-29',
              '2018-04-30',
              '2018-07-30',
              '2018-10-29',
            ]);
          },
        );
      },
    );

    describe(
      'yearly',
      () => {
        it(
          'is due on the anniversary in matching years',
          () => {
            const task = daily({
              frequency: 'yearly',
              everyX: 2,
              startDate: '2017-05-01',
            });
            expect(shouldDo(
              '2017-05-01',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2018-05-01',
              task,
            )).toBe(false);
            expect(shouldDo(
              '2019-05-01',
              task,
            )).toBe(true);
            expect(shouldDo(
              '2019-05-02',
              task,
            )).toBe(false);
          },
        );

        it(
          'computes next due dates',
          () => {
            expect(nextDueDates(
              '2017-05-01',
              daily({
                frequency: 'yearly',
                everyX: 5,
              }),
            )).toEqual([
              '2022-05-01',
              '2027-05-01',
              '2032-05-01',
              '2037-05-01',
              '2042-05-01',
              '2047-05-01',
            ]);
          },
        );

        it(
          'only recurs on Feb 29 in leap years',
          () => {
            const task = daily({
              frequency: 'yearly',
              startDate: '2024-02-29',
            });
            expect(shouldDo(
              '2025-02-28',
              task,
            )).toBe(false);
            expect(nextDueDates(
              '2024-02-29',
              task,
              2,
            )).toEqual([
              '2028-02-29',
              '2032-02-29',
            ]);
          },
        );
      },
    );
  },
);

describe(
  'isDueOn',
  () => {
    it(
      'uses the CDS day of the instant',
      () => {
        const ctx = {
          timezone: 'UTC',
          dayStart: 7,
        };
        const task = daily({
          frequency: 'daily',
          everyX: 2,
          startDate: '2017-05-01',
        });
        expect(isDueOn(
          new Date('2017-05-03T01:00:00Z'),
          task,
          ctx,
        )).toBe(false);
        expect(isDueOn(
          new Date('2017-05-03T09:00:00Z'),
          task,
          ctx,
        )).toBe(true);
        expect(isDueOn(
          new Date('2017-05-04T01:00:00Z'),
          task,
          ctx,
        )).toBe(true);
        expect(isDueOn(
          new Date('2017-05-04T09:00:00Z'),
          task,
          ctx,
        )).toBe(false);
      },
    );
  },
);

describe(
  'yesterdailies',
  () => {
    it(
      'lists uncompleted opted-in dailies due yesterday',
      () => {
        const ctx = {
          timezone: 'UTC',
          dayStart: 0,
        };
        const now = new Date('2017-05-05T08:00:00Z');
        const candidates = [
          {
            ...daily(),
            completed: false,
            yesterdaily: true,
            id: 'a',
          },
          {
            ...daily(),
            completed: true,
            yesterdaily: true,
            id: 'b',
          },
          {
            ...daily(),
            completed: false,
            yesterdaily: false,
            id: 'c',
          },
          {
            ...daily({ startDate: '2017-05-05' }),
            completed: false,
            yesterdaily: true,
            id: 'd',
          },
        ];
        expect(yesterdailies(
          candidates,
          now,
          ctx,
        ).map((task) => task.id)).toEqual(['a']);
      },
    );
  },
);
