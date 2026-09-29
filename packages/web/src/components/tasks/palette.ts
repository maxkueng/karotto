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

const overlay = (percent: number) => `color-mix(in oklab, var(--color-black) ${percent}%, transparent)`;

/** Controls sit on the hue's darker steps so they stay visible on pastel dark-theme strips. */
function huePalette(
  hue: string,
  headingOnBg: string,
): TaskPalette {
  return {
    bg: `var(--color-${hue}-100)`,
    dark: `var(--color-${hue}-1)`,
    innerHabit: `var(--color-${hue}-10)`,
    innerHabitHover: `var(--color-${hue}-5)`,
    headingOnBg,
  };
}

/** Task colours resolve through the theme's CSS variables, so every theme restyles them. */
export const palettes: Record<TaskColor | 'brand', TaskPalette> = {
  worst: huePalette(
    'maroon',
    'var(--color-white)',
  ),
  worse: huePalette(
    'red',
    'var(--color-red-1)',
  ),
  bad: huePalette(
    'orange',
    'var(--color-orange-1)',
  ),
  neutral: huePalette(
    'yellow',
    'var(--color-yellow-1)',
  ),
  good: huePalette(
    'green',
    'var(--color-green-1)',
  ),
  better: huePalette(
    'teal',
    'var(--color-teal-1)',
  ),
  best: huePalette(
    'blue',
    'var(--color-blue-1)',
  ),
  brand: {
    bg: 'var(--color-brand-300)',
    dark: 'var(--color-brand-300)',
    innerHabit: overlay(25),
    innerHabitHover: overlay(50),
    headingOnBg: 'var(--color-white)',
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
