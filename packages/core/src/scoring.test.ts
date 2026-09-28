import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  Daily,
  Habit,
  Todo,
} from '@karotto/core/schemas/task';
import {
  forwardDelta,
  reverseDelta,
  scoreDaily,
  scoreHabit,
  scoreTodo,
} from '@karotto/core/scoring';

const ctx = {
  timezone: 'UTC',
  dayStart: 0,
};
const now = new Date('2026-09-28T10:00:00Z');

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  text: 't',
  notes: '',
  alias: null,
  tags: [],
  reminders: [],
  position: 0,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

function habit(value = 0): Habit {
  return {
    ...base,
    type: 'habit',
    value,
    up: true,
    down: true,
    counterUp: 0,
    counterDown: 0,
    frequency: 'daily',
  };
}

function daily(value = 0): Daily {
  return {
    ...base,
    type: 'daily',
    value,
    completed: false,
    collapseChecklist: false,
    checklist: [],
    frequency: 'weekly',
    everyX: 1,
    startDate: '2026-01-01',
    repeat: {
      su: true,
      m: true,
      t: true,
      w: true,
      th: true,
      f: true,
      s: true,
    },
    streak: 3,
    daysOfMonth: [],
    weeksOfMonth: [],
    yesterdaily: true,
    isDue: true,
  };
}

function todo(value = 0): Todo {
  return {
    ...base,
    type: 'todo',
    value,
    completed: false,
    collapseChecklist: false,
    checklist: [],
    dueDate: null,
    dateCompleted: null,
  };
}

describe(
  'delta curves',
  () => {
    it(
      'matches Habitica reference vectors',
      () => {
        const vectors: [number, number, number][] = [
          [
            -60,
            3.357913,
            -3.691022,
          ],
          [
            -30,
            2.157104,
            -2.287317,
          ],
          [
            -20,
            1.669478,
            -1.745857,
          ],
          [
            -10,
            1.292083,
            -1.337121,
          ],
          [
            -1,
            1.025957,
            -1.054045,
          ],
          [
            0,
            1,
            -1.026657,
          ],
          [
            1,
            0.9747,
            -1,
          ],
          [
            5,
            0.879741,
            -0.900272,
          ],
          [
            10,
            0.773944,
            -0.789761,
          ],
          [
            30,
            0.57981,
            -0.58862,
          ],
        ];
        vectors.forEach(([
          value,
          up,
          reverse,
        ]) => {
          expect(forwardDelta(
            value,
            'up',
          )).toBeCloseTo(
            up,
            5,
          );
          expect(forwardDelta(
            value,
            'down',
          )).toBeCloseTo(
            -up,
            5,
          );
          expect(reverseDelta(value)).toBeCloseTo(
            reverse,
            5,
          );
        });
      },
    );

    it(
      'reverse is the inverse of an up step',
      () => {
        [
          -30,
          -5,
          0,
          3,
          12,
        ].forEach((start) => {
          const afterUp = start + forwardDelta(
            start,
            'up',
          );
          expect(afterUp + reverseDelta(afterUp)).toBeCloseTo(
            start,
            5,
          );
        });
      },
    );
  },
);

describe(
  'scoreHabit',
  () => {
    it(
      'steps value ten times from zero like Habitica',
      () => {
        let task = habit();
        const values: number[] = [];
        for (let i = 0; i < 10; i += 1) {
          task = scoreHabit({
            task,
            direction: 'up',
            now,
            ctx,
            lastEntry: null,
          }).task;
          values.push(Number(task.value.toFixed(4)));
        }
        expect(values).toEqual([
          1,
          1.9747,
          2.9254,
          3.8531,
          4.7591,
          5.6443,
          6.5096,
          7.356,
          8.1842,
          8.995,
        ]);
        expect(task.counterUp).toBe(10);
      },
    );

    it(
      'applies times with recomputed deltas',
      () => {
        const once = scoreHabit({
          task: habit(),
          direction: 'up',
          now,
          ctx,
          lastEntry: null,
        });
        const five = scoreHabit({
          task: habit(),
          direction: 'up',
          times: 5,
          now,
          ctx,
          lastEntry: null,
        });
        expect(five.delta).toBeLessThan(once.delta * 5);
        expect(five.task.value).toBeCloseTo(
          4.7591,
          3,
        );
      },
    );

    it(
      'updates the history entry of the same CDS day',
      () => {
        const first = scoreHabit({
          task: habit(),
          direction: 'up',
          now,
          ctx,
          lastEntry: null,
        });
        expect(first.history).toMatchObject({
          op: 'append',
          entry: {
            scoredUp: 1,
            scoredDown: 0,
          },
        });
        const second = scoreHabit({
          task: first.task,
          direction: 'down',
          now: new Date('2026-09-28T20:00:00Z'),
          ctx,
          lastEntry: first.history?.op === 'append' ? first.history.entry : null,
        });
        expect(second.history).toMatchObject({
          op: 'replaceLast',
          entry: {
            scoredUp: 1,
            scoredDown: 1,
          },
        });
        const nextDay = scoreHabit({
          task: second.task,
          direction: 'up',
          now: new Date('2026-09-29T01:00:00Z'),
          ctx,
          lastEntry: second.history?.op === 'replaceLast' ? second.history.entry : null,
        });
        expect(nextDay.history?.op).toBe('append');
      },
    );
  },
);

describe(
  'scoreDaily',
  () => {
    it(
      'checks and unchecks as a round trip',
      () => {
        const checked = scoreDaily({
          task: daily(2),
          direction: 'up',
          now,
          ctx,
        });
        expect(checked.task.completed).toBe(true);
        expect(checked.task.streak).toBe(4);
        expect(checked.history).toMatchObject({
          op: 'append',
          entry: { completed: true },
        });
        const unchecked = scoreDaily({
          task: checked.task,
          direction: 'down',
          now,
          ctx,
        });
        expect(unchecked.task.completed).toBe(false);
        expect(unchecked.task.streak).toBe(3);
        expect(unchecked.task.value).toBeCloseTo(
          2,
          5,
        );
        expect(unchecked.history).toEqual({
          op: 'removeCheck',
          day: '2026-09-28',
        });
      },
    );

    it(
      'never drops the streak below zero',
      () => {
        const task = {
          ...daily(),
          streak: 0,
          completed: true,
        };
        expect(scoreDaily({
          task,
          direction: 'down',
          now,
          ctx,
        }).task.streak).toBe(0);
      },
    );
  },
);

describe(
  'scoreTodo',
  () => {
    it(
      'scales by completed checklist items',
      () => {
        const task = {
          ...todo(),
          checklist: [
            {
              id: 'a',
              text: 'a',
              completed: true,
            },
            {
              id: 'b',
              text: 'b',
              completed: true,
            },
            {
              id: 'c',
              text: 'c',
              completed: false,
            },
          ],
        };
        const done = scoreTodo({
          task,
          direction: 'up',
          now,
        });
        expect(done.delta).toBeCloseTo(
          3,
          5,
        );
        expect(done.task.completed).toBe(true);
        expect(done.task.dateCompleted).toBe(now.toISOString());
        const undone = scoreTodo({
          task: done.task,
          direction: 'down',
          now,
        });
        expect(undone.task.completed).toBe(false);
        expect(undone.task.dateCompleted).toBeNull();
        expect(undone.delta).toBeCloseTo(
          reverseDelta(3) * 3,
          5,
        );
      },
    );
  },
);
