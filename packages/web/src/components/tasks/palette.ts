import { taskColor } from '@karotto/core';
import type {
  Task,
  TaskColor,
} from '@karotto/core';

export type TaskPalette = {
  bg: string;
  dark: string;
  innerHabit: string;
  innerHabitHover: string;
  headingOnBg: string;
};

const black = 'rgba(26, 24, 29, 0.25)';
const blackHover = 'rgba(26, 24, 29, 0.5)';

export const palettes: Record<TaskColor | 'purple', TaskPalette> = {
  worst: {
    bg: '#de3f3f',
    dark: '#6c0406',
    innerHabit: black,
    innerHabitHover: blackHover,
    headingOnBg: '#ffffff',
  },
  worse: {
    bg: '#ff6165',
    dark: '#6c0406',
    innerHabit: black,
    innerHabitHover: blackHover,
    headingOnBg: '#6c0406',
  },
  bad: {
    bg: '#ff944c',
    dark: '#7f3300',
    innerHabit: 'rgba(127, 51, 0, 0.25)',
    innerHabitHover: 'rgba(127, 51, 0, 0.5)',
    headingOnBg: '#7f3300',
  },
  neutral: {
    bg: '#ffbe5d',
    dark: '#794b00',
    innerHabit: 'rgba(121, 75, 0, 0.25)',
    innerHabitHover: 'rgba(121, 75, 0, 0.5)',
    headingOnBg: '#794b00',
  },
  good: {
    bg: '#24cc8f',
    dark: '#005737',
    innerHabit: black,
    innerHabitHover: blackHover,
    headingOnBg: '#005737',
  },
  better: {
    bg: '#3bcad7',
    dark: '#005158',
    innerHabit: black,
    innerHabitHover: blackHover,
    headingOnBg: '#005158',
  },
  best: {
    bg: '#50b5e9',
    dark: '#033f5e',
    innerHabit: black,
    innerHabitHover: blackHover,
    headingOnBg: '#033f5e',
  },
  purple: {
    bg: '#6133b4',
    dark: '#6133b4',
    innerHabit: black,
    innerHabitHover: blackHover,
    headingOnBg: '#ffffff',
  },
};

export function paletteFor(task: Pick<Task, 'value'>): TaskPalette {
  return palettes[taskColor(task.value)];
}

export function paletteVars(palette: TaskPalette): Record<string, string> {
  return {
    '--task-bg': palette.bg,
    '--task-dark': palette.dark,
    '--task-inner': palette.innerHabit,
    '--task-inner-hover': palette.innerHabitHover,
    '--task-heading': palette.headingOnBg,
  };
}
