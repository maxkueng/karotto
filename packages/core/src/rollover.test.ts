import {
  describe,
  expect,
  it,
} from 'vitest';
import { computeRollover } from '@karotto/core/rollover';
import { everyDay } from '@karotto/core/schemas/task';
import type {
  Daily,
  Habit,
  Todo,
} from '@karotto/core/schemas/task';

const base = {
  text: 't',
  notes: '',
  alias: null,
  tags: [],
  reminders: [],
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    ...base,
    id: 'h',
    type: 'habit',
    value: 4,
    up: true,
    down: true,
    counterUp: 3,
    counterDown: 1,
    frequency: 'daily',
    ...overrides,
  };
}

function daily(overrides: Partial<Daily> = {}): Daily {
  return {
    ...base,
    id: 'd',
    type: 'daily',
    value: 0,
    completed: false,
    collapseChecklist: false,
    checklist: [],
    frequency: 'weekly',
    everyX: 1,
    startDate: '2026-01-01',
    repeat: everyDay,
    streak: 5,
    daysOfMonth: [],
    weeksOfMonth: [],
    yesterdaily: true,
    isDue: true,
    ...overrides,
  };
}

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    ...base,
    id: 't',
    type: 'todo',
    value: 0,
    completed: false,
    collapseChecklist: false,
    checklist: [],
    dueDate: null,
    dateCompleted: null,
    ...overrides,
  };
}

const ctx = {
  timezone: 'UTC',
  dayStart: 0,
};

function run(input: Partial<Parameters<typeof computeRollover>[0]>) {
  return computeRollover({
    now: new Date('2026-09-28T08:00:00Z'),
    lastCron: new Date('2026-09-27T09:00:00Z'),
    ctx,
    habits: [],
    dailies: [],
    todos: [],
    ...input,
  });
}

describe(
  'computeRollover',
  () => {
    it(
      'does nothing when no day boundary was crossed',
      () => {
        expect(run({ lastCron: new Date('2026-09-28T01:00:00Z') })).toBeNull();
      },
    );

    it(
      'decays uncompleted todos once and leaves completed ones',
      () => {
        const result = run({
          todos: [
            todo(),
            todo({
              id: 'done',
              completed: true,
            }),
          ],
        });
        expect(result?.todos[0]?.value).toBeCloseTo(
          -1,
          5,
        );
        expect(result?.todos[1]?.value).toBe(0);
      },
    );

    it(
      'penalises a missed due daily and resets streak',
      () => {
        const result = run({ dailies: [daily()] });
        const rolled = result?.dailies[0];
        expect(rolled?.value).toBeCloseTo(
          -1,
          5,
        );
        expect(rolled?.streak).toBe(0);
        expect(rolled?.completed).toBe(false);
        expect(result?.history).toEqual([
          {
            taskId: 'd',
            entry: expect.objectContaining({
              isDue: true,
              completed: false,
            }),
          },
        ]);
      },
    );

    it(
      'keeps values and streaks while paused but still resets the day',
      () => {
        const result = run({
          paused: true,
          dailies: [
            daily({
              streak: 12,
              checklist: [
                {
                  id: 'c',
                  text: 'x',
                  completed: true,
                },
              ],
            }),
            daily({
              id: 'done',
              completed: true,
              streak: 3,
            }),
          ],
          todos: [todo()],
        });
        const missed = result?.dailies[0];
        expect(missed?.value).toBe(0);
        expect(missed?.streak).toBe(12);
        expect(missed?.completed).toBe(false);
        expect(missed?.checklist[0]?.completed).toBe(false);
        expect(result?.dailies[1]?.completed).toBe(false);
        expect(result?.dailies[1]?.streak).toBe(3);
        expect(result?.todos[0]?.value).toBe(0);
        expect(result?.history).toHaveLength(1);
      },
    );

    it(
      'scales the penalty by checklist completion and resets the checklist',
      () => {
        const result = run({
          dailies: [
            daily({
              checklist: [
                {
                  id: 'a',
                  text: 'a',
                  completed: true,
                },
                {
                  id: 'b',
                  text: 'b',
                  completed: false,
                },
              ],
            }),
          ],
        });
        const rolled = result?.dailies[0];
        expect(rolled?.value).toBeCloseTo(
          -0.5,
          5,
        );
        expect(rolled?.checklist.every((item) => !item.completed)).toBe(true);
      },
    );

    it(
      'leaves a not-due daily alone but records history',
      () => {
        const result = run({
          dailies: [
            daily({
              repeat: {
                ...everyDay,
                su: false,
              },
              checklist: [
                {
                  id: 'a',
                  text: 'a',
                  completed: true,
                },
              ],
            }),
          ],
        });
        const rolled = result?.dailies[0];
        expect(rolled?.value).toBe(0);
        expect(rolled?.streak).toBe(5);
        expect(rolled?.checklist[0]?.completed).toBe(true);
        expect(result?.history[0]?.entry.isDue).toBe(false);
      },
    );

    it(
      'resets a completed daily for the new day without penalty',
      () => {
        const result = run({
          dailies: [
            daily({
              completed: true,
              value: 3,
              checklist: [
                {
                  id: 'a',
                  text: 'a',
                  completed: true,
                },
              ],
            }),
          ],
        });
        const rolled = result?.dailies[0];
        expect(rolled?.completed).toBe(false);
        expect(rolled?.value).toBe(3);
        expect(rolled?.streak).toBe(5);
        expect(rolled?.checklist[0]?.completed).toBe(false);
        expect(result?.history).toEqual([]);
      },
    );

    it(
      'penalises only once after several missed days',
      () => {
        const result = run({
          lastCron: new Date('2026-09-20T09:00:00Z'),
          dailies: [daily()],
        });
        expect(result?.daysMissed).toBe(8);
        expect(result?.dailies[0]?.value).toBeCloseTo(
          -1,
          5,
        );
      },
    );

    it(
      'resets habit counters by period',
      () => {
        const result = run({
          habits: [
            habit(),
            habit({
              id: 'w',
              frequency: 'weekly',
            }),
            habit({
              id: 'm',
              frequency: 'monthly',
            }),
          ],
        });
        expect(result?.habits[0]?.counterUp).toBe(0);
        expect(result?.habits[1]?.counterUp).toBe(0);
        expect(result?.habits[2]?.counterUp).toBe(3);
      },
    );

    it(
      'does not reset weekly counters mid-week',
      () => {
        const result = run({
          now: new Date('2026-09-30T08:00:00Z'),
          lastCron: new Date('2026-09-29T08:00:00Z'),
          habits: [
            habit({ frequency: 'weekly' }),
            habit({
              id: 'm',
              frequency: 'monthly',
            }),
          ],
        });
        expect(result?.habits[0]?.counterUp).toBe(3);
        expect(result?.habits[1]?.counterUp).toBe(3);
      },
    );

    it(
      'resets monthly counters when the month changes',
      () => {
        const result = run({
          now: new Date('2026-10-01T08:00:00Z'),
          lastCron: new Date('2026-09-30T08:00:00Z'),
          habits: [habit({ frequency: 'monthly' })],
        });
        expect(result?.habits[0]?.counterUp).toBe(0);
      },
    );

    it(
      'decays one-sided habits toward zero',
      () => {
        const result = run({
          habits: [
            habit({ down: false }),
            habit({
              id: 'tiny',
              down: false,
              value: 0.05,
            }),
            habit({ id: 'both' }),
          ],
        });
        expect(result?.habits[0]?.value).toBe(2);
        expect(result?.habits[1]?.value).toBe(0);
        expect(result?.habits[2]?.value).toBe(4);
      },
    );
  },
);
