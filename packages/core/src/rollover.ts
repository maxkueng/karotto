import {
  addDays,
  isoWeek,
  monthIndex,
} from '@karotto/core/civil';
import type { IsoDate } from '@karotto/core/civil';
import { shouldDo } from '@karotto/core/schedule';
import type {
  Daily,
  Habit,
  HistoryEntry,
  Todo,
} from '@karotto/core/schemas/task';
import {
  decayedOneSidedHabitValue,
  missedDailyDelta,
  todoDecayDelta,
} from '@karotto/core/scoring';
import {
  cdsDay,
  daysBetween,
} from '@karotto/core/time';
import type { DayContext } from '@karotto/core/time';

export type RolloverInput = {
  now: Date;
  lastCron: Date;
  ctx: DayContext;
  habits: Habit[];
  dailies: Daily[];
  todos: Todo[];
};

export type RolloverHistory = {
  taskId: string;
  entry: HistoryEntry;
};

export type RolloverResult = {
  daysMissed: number;
  today: IsoDate;
  yesterday: IsoDate;
  habits: Habit[];
  dailies: Daily[];
  todos: Todo[];
  history: RolloverHistory[];
};

export function daysMissedSince(
  lastCron: Date,
  now: Date,
  ctx: DayContext,
): number {
  return daysBetween(
    lastCron,
    now,
    ctx,
  );
}

function resetChecklist(daily: Daily): Daily {
  return {
    ...daily,
    checklist: daily.checklist.map((item) => ({
      ...item,
      completed: false,
    })),
  };
}

function rollDaily(
  daily: Daily,
  today: IsoDate,
  yesterday: IsoDate,
  now: Date,
  history: RolloverHistory[],
): Daily {
  const isDueToday = shouldDo(
    today,
    daily,
  );
  if (daily.completed) {
    return resetChecklist({
      ...daily,
      completed: false,
      isDue: isDueToday,
    });
  }

  const wasDueYesterday = shouldDo(
    yesterday,
    daily,
  );
  let next: Daily = {
    ...daily,
    isDue: isDueToday,
  };
  if (wasDueYesterday) {
    next = resetChecklist({
      ...next,
      value: daily.value + missedDailyDelta(daily),
      streak: 0,
    });
  }
  history.push({
    taskId: daily.id,
    entry: {
      date: now.toISOString(),
      value: next.value,
      scoredUp: null,
      scoredDown: null,
      isDue: wasDueYesterday,
      completed: false,
    },
  });
  return next;
}

function rollHabit(
  habit: Habit,
  today: IsoDate,
  daysMissed: number,
): Habit {
  const thatDay = addDays(
    today,
    -daysMissed,
  );
  const nowWeek = isoWeek(today);
  const thenWeek = isoWeek(thatDay);
  const resetWeekly = nowWeek.year !== thenWeek.year || nowWeek.week !== thenWeek.week;
  const resetMonthly = monthIndex(today) !== monthIndex(thatDay);
  const reset = habit.frequency === 'daily'
    || (habit.frequency === 'weekly' && resetWeekly)
    || (habit.frequency === 'monthly' && resetMonthly);
  const oneSided = !habit.up || !habit.down;
  return {
    ...habit,
    counterUp: reset ? 0 : habit.counterUp,
    counterDown: reset ? 0 : habit.counterDown,
    value: oneSided ? decayedOneSidedHabitValue(habit.value) : habit.value,
  };
}

function rollTodo(todo: Todo): Todo {
  if (todo.completed) {
    return todo;
  }
  return {
    ...todo,
    value: todo.value + todoDecayDelta(todo),
  };
}

export function computeRollover(input: RolloverInput): RolloverResult | null {
  const {
    now,
    lastCron,
    ctx,
  } = input;
  const daysMissed = daysMissedSince(
    lastCron,
    now,
    ctx,
  );
  if (daysMissed <= 0) {
    return null;
  }
  const today = cdsDay(
    now,
    ctx,
  );
  const yesterday = addDays(
    today,
    -1,
  );
  const history: RolloverHistory[] = [];
  return {
    daysMissed,
    today,
    yesterday,
    habits: input.habits.map((habit) => rollHabit(
      habit,
      today,
      daysMissed,
    )),
    dailies: input.dailies.map((daily) => rollDaily(
      daily,
      today,
      yesterday,
      now,
      history,
    )),
    todos: input.todos.map(rollTodo),
    history,
  };
}
