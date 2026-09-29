import { CliError } from '@/client';

const dayKeys: Record<string, string> = {
  mon: 'm',
  tue: 't',
  wed: 'w',
  thu: 'th',
  fri: 'f',
  sat: 's',
  sun: 'su',
};

export function parseRepeat(spec: string): Record<string, boolean> {
  const repeat: Record<string, boolean> = {
    su: false,
    m: false,
    t: false,
    w: false,
    th: false,
    f: false,
    s: false,
  };
  if (spec === 'all' || spec === '*') {
    Object.keys(repeat).forEach((key) => {
      repeat[key] = true;
    });
    return repeat;
  }
  spec.split(',').map((part) => part.trim().toLowerCase().slice(
    0,
    3,
  )).filter(Boolean).forEach((day) => {
    const key = dayKeys[day];
    if (!key) {
      throw new CliError(
        'usage',
        `Unknown weekday "${day}"; use mon,tue,wed,thu,fri,sat,sun or all`,
        2,
      );
    }
    repeat[key] = true;
  });
  return repeat;
}

export type TaskFlags = {
  text?: string;
  notes?: string;
  alias?: string | null;
  tags?: string[];
  due?: string | null;
  start?: string;
  frequency?: string;
  every?: number;
  repeat?: string;
  up?: boolean;
  down?: boolean;
  reset?: string;
  checklist?: string[];
  streak?: number;
};

/** Builds the JSON body shared by create and update from CLI flags; only set flags are included. */
export function taskBody(
  type: 'habit' | 'daily' | 'todo',
  flags: TaskFlags,
  tagIds?: string[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (flags.text !== undefined) {
    body.text = flags.text;
  }
  if (flags.notes !== undefined) {
    body.notes = flags.notes;
  }
  if (flags.alias !== undefined) {
    body.alias = flags.alias === '' ? null : flags.alias;
  }
  if (tagIds !== undefined) {
    body.tags = tagIds;
  }
  if (flags.checklist !== undefined && type !== 'habit') {
    body.checklist = flags.checklist.map((text) => ({ text }));
  }
  if (type === 'habit') {
    if (flags.up !== undefined) {
      body.up = flags.up;
    }
    if (flags.down !== undefined) {
      body.down = flags.down;
    }
    if (flags.reset !== undefined) {
      body.frequency = flags.reset;
    }
  }
  if (type === 'daily') {
    if (flags.frequency !== undefined) {
      body.frequency = flags.frequency;
    }
    if (flags.every !== undefined) {
      body.everyX = flags.every;
    }
    if (flags.start !== undefined) {
      body.startDate = flags.start;
    }
    if (flags.repeat !== undefined) {
      body.repeat = parseRepeat(flags.repeat);
      if (flags.frequency === undefined) {
        body.frequency = 'weekly';
      }
    }
    if (flags.streak !== undefined) {
      body.streak = flags.streak;
    }
  }
  if (type === 'todo' && flags.due !== undefined) {
    body.dueDate = flags.due === '' ? null : flags.due;
  }
  return body;
}
