import {
  isDueOn,
} from '@karotto/core';
import type {
  Daily,
  DailyFrequency,
  DayContext,
  Habit,
  HabitFrequency,
  HistoryEntry,
  Task,
  Todo,
} from '@karotto/core';
import type {
  TaskHistoryRow,
  TaskRow,
} from '@/db/schema';

function base(
  row: TaskRow,
  tagIds: string[],
) {
  return {
    id: row.id,
    text: row.text,
    notes: row.notes,
    alias: row.alias,
    value: row.value,
    tags: tagIds,
    reminders: row.reminders,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeTask(
  row: TaskRow,
  tagIds: string[],
  ctx: DayContext,
  now: Date,
): Task {
  switch (row.type) {
    case 'habit': {
      const habit: Habit = {
        ...base(
          row,
          tagIds,
        ),
        type: 'habit',
        up: row.up,
        down: row.down,
        counterUp: row.counterUp,
        counterDown: row.counterDown,
        frequency: row.frequency as HabitFrequency,
      };
      return habit;
    }
    case 'daily': {
      const schedule = {
        frequency: row.frequency as DailyFrequency,
        everyX: row.everyX,
        startDate: row.startDate ?? '1970-01-01',
        repeat: row.repeat,
        daysOfMonth: row.daysOfMonth,
        weeksOfMonth: row.weeksOfMonth,
      };
      const daily: Daily = {
        ...base(
          row,
          tagIds,
        ),
        type: 'daily',
        completed: row.completed,
        collapseChecklist: row.collapseChecklist,
        checklist: row.checklist,
        ...schedule,
        streak: row.streak,
        yesterdaily: row.yesterdaily,
        isDue: isDueOn(
          now,
          schedule,
          ctx,
        ),
      };
      return daily;
    }
    case 'todo': {
      const todo: Todo = {
        ...base(
          row,
          tagIds,
        ),
        type: 'todo',
        completed: row.completed,
        collapseChecklist: row.collapseChecklist,
        checklist: row.checklist,
        dueDate: row.dueDate,
        dateCompleted: row.dateCompleted?.toISOString() ?? null,
      };
      return todo;
    }
  }
}

export function serializeHistory(row: TaskHistoryRow): HistoryEntry {
  return {
    date: row.date.toISOString(),
    value: row.value,
    scoredUp: row.scoredUp,
    scoredDown: row.scoredDown,
    isDue: row.isDue,
    completed: row.completed,
  };
}
