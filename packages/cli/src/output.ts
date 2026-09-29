import {
  taskColor,
} from '@karotto/core';
import type {
  Tag,
  Task,
} from '@karotto/core';
import { CliError } from '@/client';

export type Output = {
  json: boolean;
};

export function print(
  output: Output,
  data: unknown,
  human: () => string,
): void {
  if (output.json) {
    process.stdout.write(`${JSON.stringify(
      data,
      null,
      2,
    )}\n`);
    return;
  }
  const text = human();
  if (text) {
    process.stdout.write(`${text}\n`);
  }
}

export function fail(
  output: Output,
  error: unknown,
): never {
  const cliError = error instanceof CliError
    ? error
    : new CliError(
        'error',
        error instanceof Error ? error.message : String(error),
      );
  if (output.json) {
    process.stderr.write(`${JSON.stringify({
      error: {
        code: cliError.code,
        message: cliError.message,
        ...(cliError.details === undefined ? {} : { details: cliError.details }),
      },
    })}\n`);
  } else {
    process.stderr.write(`karotto: ${cliError.message} (${cliError.code})\n`);
  }
  process.exit(cliError.exitCode);
}

export function table(
  rows: string[][],
  gap = 2,
): string {
  if (rows.length === 0) {
    return '';
  }
  const widths: number[] = [];
  rows.forEach((row) => row.forEach((
    cell,
    index,
  ) => {
    widths[index] = Math.max(
      widths[index] ?? 0,
      cell.length,
    );
  }));
  return rows
    .map((row) => row
      .map((
        cell,
        index,
      ) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
      .join(' '.repeat(gap))
      .trimEnd())
    .join('\n');
}

export function shortId(id: string): string {
  return id.slice(
    0,
    8,
  );
}

function stateOf(task: Task): string {
  switch (task.type) {
    case 'habit':
      return `${task.up ? '+' : ' '}${task.down ? '-' : ' '}`;
    case 'daily':
      return task.completed ? '[x]' : (task.isDue ? '[ ]' : '[~]');
    case 'todo':
      return task.completed ? '[x]' : '[ ]';
  }
}

function extraOf(task: Task): string {
  switch (task.type) {
    case 'habit':
      return `+${task.counterUp}/-${task.counterDown}`;
    case 'daily':
      return task.streak > 0 ? `streak ${task.streak}` : '';
    case 'todo':
      return task.dueDate ? `due ${task.dueDate}` : '';
  }
}

export function taskRows(
  tasks: Task[],
  tagsById: Map<string, Tag>,
): string[][] {
  return tasks.map((task) => [
    task.alias ?? shortId(task.id),
    stateOf(task),
    task.type,
    task.text,
    taskColor(task.value),
    extraOf(task),
    task.tags.map((id) => tagsById.get(id)?.name ?? shortId(id)).map((name) => `#${name}`).join(' '),
  ]);
}

export function taskDetail(
  task: Task,
  tagsById: Map<string, Tag>,
): string {
  const lines: string[][] = [
    [
      'id',
      task.id,
    ],
    [
      'alias',
      task.alias ?? '',
    ],
    [
      'type',
      task.type,
    ],
    [
      'text',
      task.text,
    ],
    [
      'notes',
      task.notes,
    ],
    [
      'value',
      `${task.value.toFixed(2)} (${taskColor(task.value)})`,
    ],
    [
      'tags',
      task.tags.map((id) => tagsById.get(id)?.name ?? shortId(id)).join(', '),
    ],
  ];
  if (task.type === 'habit') {
    lines.push(
      [
        'directions',
        `${task.up ? 'up ' : ''}${task.down ? 'down' : ''}`.trim(),
      ],
      [
        'counters',
        `+${task.counterUp} / -${task.counterDown} (reset ${task.frequency})`,
      ],
    );
  }
  if (task.type === 'daily') {
    lines.push(
      [
        'schedule',
        `${task.frequency} every ${task.everyX}, from ${task.startDate}`,
      ],
      [
        'repeat',
        Object.entries(task.repeat).filter(([
          ,
          on,
        ]) => on).map(([day]) => day).join(','),
      ],
      [
        'due today',
        task.isDue ? 'yes' : 'no',
      ],
      [
        'completed',
        task.completed ? 'yes' : 'no',
      ],
      [
        'streak',
        String(task.streak),
      ],
    );
  }
  if (task.type === 'todo') {
    lines.push(
      [
        'due',
        task.dueDate ?? '',
      ],
      [
        'completed',
        task.completed ? `yes (${task.dateCompleted ?? ''})` : 'no',
      ],
    );
  }
  if (task.type !== 'habit' && task.checklist.length > 0) {
    lines.push([
      'checklist',
      task.checklist.map((
        item,
        index,
      ) => `${index + 1}. ${item.completed ? '[x]' : '[ ]'} ${item.text}`).join('\n'),
    ]);
  }
  if (task.reminders.length > 0) {
    lines.push([
      'reminders',
      task.reminders.map((reminder) => reminder.time).join(', '),
    ]);
  }
  return lines.filter(([
    ,
    value,
  ]) => value !== '').map(([
    key,
    value,
  ]) => `${(key ?? '').padEnd(11)} ${value?.split('\n').join(`\n${' '.repeat(12)}`)}`).join('\n');
}
