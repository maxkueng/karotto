import type { TaskType } from '@karotto/core';
import CalendarDays from 'lucide-solid/icons/calendar-days';
import Diff from 'lucide-solid/icons/diff';
import SquareCheck from 'lucide-solid/icons/square-check';
import type { JSX } from 'solid-js';

export type TaskTypeMeta = {
  label: string;
  plural: string;
  placeholder: string;
  emptyText: string;
  icon: (size: number) => JSX.Element;
};

export const taskTypes: Record<TaskType, TaskTypeMeta> = {
  habit: {
    label: 'Habit',
    plural: 'Habits',
    placeholder: 'Add a Habit',
    emptyText: 'Habits don\'t have a rigid schedule. You can check them off multiple times per day.',
    icon: (size) => <Diff size={size} />,
  },
  daily: {
    label: 'Daily',
    plural: 'Dailies',
    placeholder: 'Add a Daily',
    emptyText: 'Dailies repeat on a regular basis. Choose the schedule that works best for you!',
    icon: (size) => <CalendarDays size={size} />,
  },
  todo: {
    label: 'To Do',
    plural: 'To Do\'s',
    placeholder: 'Add a To Do',
    emptyText: 'To Do\'s need to be completed once. Add checklists to your To Do\'s to increase their value.',
    icon: (size) => <SquareCheck size={size} />,
  },
};

export const taskTypeOrder: TaskType[] = [
  'habit',
  'daily',
  'todo',
];
