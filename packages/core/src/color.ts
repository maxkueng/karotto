import type { Task } from '@karotto/core/schemas/task';
import type {
  DailyFilter,
  HabitFilter,
  TodoFilter,
} from '@karotto/core/schemas/user';

export const taskColors = [
  'worst',
  'worse',
  'bad',
  'neutral',
  'good',
  'better',
  'best',
] as const;
export type TaskColor = (typeof taskColors)[number];

export function taskColor(value: number): TaskColor {
  if (value < -20) {
    return 'worst';
  }
  if (value < -10) {
    return 'worse';
  }
  if (value < -1) {
    return 'bad';
  }
  if (value < 1) {
    return 'neutral';
  }
  if (value < 5) {
    return 'good';
  }
  if (value < 10) {
    return 'better';
  }
  return 'best';
}

export function matchesFilter(
  task: Task,
  filter: HabitFilter | DailyFilter | TodoFilter,
): boolean {
  switch (task.type) {
    case 'habit':
      switch (filter) {
        case 'weak':
          return task.value < 1;
        case 'strong':
          return task.value >= 1;
        default:
          return true;
      }
    case 'daily':
      switch (filter) {
        case 'due':
          return !task.completed && task.isDue;
        case 'notDue':
          return task.completed || !task.isDue;
        default:
          return true;
      }
    case 'todo':
      switch (filter) {
        case 'active':
          return !task.completed;
        case 'scheduled':
          return !task.completed && task.dueDate !== null;
        case 'complete':
          return task.completed;
        default:
          return true;
      }
  }
}

export function matchesSearch(
  task: Task,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  if (task.text.toLowerCase().includes(needle) || task.notes.toLowerCase().includes(needle)) {
    return true;
  }
  if (task.type === 'habit') {
    return false;
  }
  return task.checklist.some((item) => item.text.toLowerCase().includes(needle));
}

export function hasAllTags(
  task: Task,
  tagIds: readonly string[],
): boolean {
  return tagIds.every((id) => task.tags.includes(id));
}
