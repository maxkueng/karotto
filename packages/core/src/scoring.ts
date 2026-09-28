import type {
  ChecklistItem,
  Daily,
  Habit,
  HistoryEntry,
  ScoreDirection,
  Todo,
} from '@karotto/core/schemas/task';
import {
  cdsDay,
  isSameCdsDay,
} from '@karotto/core/time';
import type { DayContext } from '@karotto/core/time';

export const MAX_TASK_VALUE = 21.27;
export const MIN_TASK_VALUE = -47.27;
const CLOSE_ENOUGH = 0.00001;
const BASE = 0.9747;

function clampValue(value: number): number {
  if (value < MIN_TASK_VALUE) {
    return MIN_TASK_VALUE;
  }
  if (value > MAX_TASK_VALUE) {
    return MAX_TASK_VALUE;
  }
  return value;
}

export function forwardDelta(
  value: number,
  direction: ScoreDirection,
): number {
  return (BASE ** clampValue(value)) * (direction === 'down' ? -1 : 1);
}

export function reverseDelta(value: number): number {
  const current = clampValue(value);
  let test = current - BASE ** current;
  for (let i = 0; i < 1000; i += 1) {
    const calc = test + BASE ** test;
    const diff = current - calc;
    if (Math.abs(diff) < CLOSE_ENOUGH) {
      break;
    }
    test += diff > 0 ? -diff : diff;
  }
  return test - current;
}

export function completedChecklistCount(checklist: ChecklistItem[]): number {
  return checklist.reduce(
    (
      sum,
      item,
    ) => sum + (item.completed ? 1 : 0),
    0,
  );
}

export function completedChecklistFraction(checklist: ChecklistItem[]): number {
  if (checklist.length === 0) {
    return 0;
  }
  return completedChecklistCount(checklist) / checklist.length;
}

export type HistoryOp
  = { op: 'append';
    entry: HistoryEntry; }
    | { op: 'replaceLast';
      entry: HistoryEntry; }
      | { op: 'removeCheck';
        day: string; };

export type ScoreOutcome<T> = {
  task: T;
  delta: number;
  history: HistoryOp | null;
};

export type HabitScoreInput = {
  task: Habit;
  direction: ScoreDirection;
  times?: number;
  now: Date;
  ctx: DayContext;
  lastEntry: HistoryEntry | null;
};

export function scoreHabit(input: HabitScoreInput): ScoreOutcome<Habit> {
  const {
    task,
    direction,
    now,
    ctx,
    lastEntry,
  } = input;
  const times = input.times ?? 1;
  let value = task.value;
  let delta = 0;
  for (let i = 0; i < times; i += 1) {
    const step = direction === 'down'
      ? reverseDelta(value)
      : forwardDelta(
          value,
          direction,
        );
    value += step;
    delta += step;
  }

  const sameDay = lastEntry !== null && isSameCdsDay(
    lastEntry.date,
    now,
    ctx,
  );
  const scoredUp = (sameDay ? lastEntry.scoredUp ?? 0 : 0) + (direction === 'up' ? times : 0);
  const scoredDown = (sameDay ? lastEntry.scoredDown ?? 0 : 0) + (direction === 'down' ? times : 0);
  const entry: HistoryEntry = {
    date: now.toISOString(),
    value,
    scoredUp,
    scoredDown,
    isDue: null,
    completed: null,
  };

  return {
    task: {
      ...task,
      value,
      counterUp: task.counterUp + (direction === 'up' ? times : 0),
      counterDown: task.counterDown + (direction === 'down' ? times : 0),
    },
    delta,
    history: {
      op: sameDay ? 'replaceLast' : 'append',
      entry,
    },
  };
}

export type DailyScoreInput = {
  task: Daily;
  direction: ScoreDirection;
  now: Date;
  ctx: DayContext;
};

export function scoreDaily(input: DailyScoreInput): ScoreOutcome<Daily> {
  const {
    task,
    direction,
    now,
    ctx,
  } = input;
  if (direction === 'up') {
    const delta = forwardDelta(
      task.value,
      'up',
    );
    const value = task.value + delta;
    return {
      task: {
        ...task,
        value,
        streak: task.streak + 1,
        completed: true,
      },
      delta,
      history: {
        op: 'append',
        entry: {
          date: now.toISOString(),
          value,
          scoredUp: null,
          scoredDown: null,
          isDue: task.isDue,
          completed: true,
        },
      },
    };
  }
  const delta = reverseDelta(task.value);
  return {
    task: {
      ...task,
      value: task.value + delta,
      streak: Math.max(
        0,
        task.streak - 1,
      ),
      completed: false,
    },
    delta,
    history: {
      op: 'removeCheck',
      day: cdsDay(
        now,
        ctx,
      ),
    },
  };
}

export type TodoScoreInput = {
  task: Todo;
  direction: ScoreDirection;
  now: Date;
};

export function scoreTodo(input: TodoScoreInput): ScoreOutcome<Todo> {
  const {
    task,
    direction,
    now,
  } = input;
  const multiplier = 1 + completedChecklistCount(task.checklist);
  if (direction === 'up') {
    const delta = forwardDelta(
      task.value,
      'up',
    ) * multiplier;
    return {
      task: {
        ...task,
        value: task.value + delta,
        completed: true,
        dateCompleted: now.toISOString(),
      },
      delta,
      history: null,
    };
  }
  const delta = reverseDelta(task.value) * multiplier;
  return {
    task: {
      ...task,
      value: task.value + delta,
      completed: false,
      dateCompleted: null,
    },
    delta,
    history: null,
  };
}

export function missedDailyDelta(task: Daily): number {
  return forwardDelta(
    task.value,
    'down',
  ) * (1 - completedChecklistFraction(task.checklist));
}

export function todoDecayDelta(task: Todo): number {
  return forwardDelta(
    task.value,
    'down',
  );
}

export function decayedOneSidedHabitValue(value: number): number {
  return Math.abs(value) < 0.1 ? 0 : value / 2;
}
