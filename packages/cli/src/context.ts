import { stdin } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type {
  ScoreResult,
  Tag,
  Task,
} from '@karotto/core';
import {
  ApiClient,
  CliError,
} from '@/client';
import { resolveConnection } from '@/config';
import {
  fail,
  print,
} from '@/output';
import type { Output } from '@/output';
import type { TaskFlags } from '@/task-input';

export type Globals = {
  json: boolean;
  url?: string | undefined;
};

export type Context = {
  api: ApiClient;
  output: Output;
};

export function context(argv: Globals): Context {
  const connection = resolveConnection(argv.url);
  return {
    api: new ApiClient(
      connection.url,
      connection.token,
    ),
    output: { json: argv.json },
  };
}

export async function readSecret(prompt: string): Promise<string> {
  if (!stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8').replace(
      /\r?\n$/,
      '',
    );
  }
  const rl = createInterface({
    input: stdin,
    output: process.stderr,
  });
  process.stderr.write(prompt);
  stdin.setRawMode(true);
  const value = await new Promise<string>((resolve) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      const char = chunk.toString('utf8');
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.off(
          'data',
          onData,
        );
        process.stderr.write('\n');
        resolve(buffer);
        return;
      }
      if (char === '\u0003') {
        process.exit(130);
      }
      buffer = char === '\u007f' || char === '\b'
        ? buffer.slice(
            0,
            -1,
          )
        : buffer + char;
    };
    stdin.on(
      'data',
      onData,
    );
  });
  rl.close();
  return value;
}

export async function tagMap(api: ApiClient): Promise<Map<string, Tag>> {
  const tags = await api.get<Tag[]>('/tags');
  return new Map(tags.map((tag) => [
    tag.id,
    tag,
  ]));
}

export async function resolveTagIds(
  api: ApiClient,
  names: string[],
  create: boolean,
): Promise<string[]> {
  const tags = await api.get<Tag[]>('/tags');
  const ids: string[] = [];
  for (const name of names) {
    const found = tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase() || tag.id === name);
    if (found) {
      ids.push(found.id);
      continue;
    }
    if (!create) {
      throw new CliError(
        'unknown_tag',
        `No tag named "${name}"`,
        2,
      );
    }
    const created = await api.post<Tag>(
      '/tags',
      { name },
    );
    tags.push(created);
    ids.push(created.id);
  }
  return ids;
}

export const taskFlagOptions = {
  notes: {
    type: 'string',
    describe: 'Markdown notes',
  },
  alias: {
    type: 'string',
    describe: 'Short name usable instead of the id ("" clears)',
  },
  tag: {
    type: 'string',
    array: true,
    describe: 'Tag names; created when missing',
  },
  due: {
    type: 'string',
    describe: 'To-do due date YYYY-MM-DD ("" clears)',
  },
  start: {
    type: 'string',
    describe: 'Daily start date YYYY-MM-DD',
  },
  frequency: {
    type: 'string',
    choices: [
      'daily',
      'weekly',
      'monthly',
      'yearly',
    ],
    describe: 'Daily schedule unit',
  },
  every: {
    type: 'number',
    describe: 'Daily: repeat every N units',
  },
  repeat: {
    type: 'string',
    describe: 'Daily: weekdays, e.g. mon,wed,fri or all',
  },
  up: {
    type: 'boolean',
    describe: 'Habit: allow +',
  },
  down: {
    type: 'boolean',
    describe: 'Habit: allow -',
  },
  reset: {
    type: 'string',
    choices: [
      'daily',
      'weekly',
      'monthly',
    ],
    describe: 'Habit: counter reset period',
  },
  checklist: {
    type: 'string',
    array: true,
    describe: 'Checklist items (replaces existing on edit)',
  },
  streak: {
    type: 'number',
    describe: 'Daily: set the streak',
  },
} as const;

export function flagsOf(argv: Record<string, unknown>): TaskFlags {
  const flags: TaskFlags = {};
  const copy = <K extends keyof TaskFlags>(key: K,
    from: string = key) => {
    if (argv[from] !== undefined) {
      flags[key] = argv[from] as TaskFlags[K];
    }
  };
  copy('text');
  copy('notes');
  copy('alias');
  copy('due');
  copy('start');
  copy('frequency');
  copy('every');
  copy('repeat');
  copy('up');
  copy('down');
  copy('reset');
  copy('checklist');
  copy('streak');
  return flags;
}

/** Accepts a full id, an alias, or a unique id prefix such as the one `tasks list` prints. */
export async function loadTask(
  api: ApiClient,
  ref: string,
): Promise<Task> {
  try {
    return await api.get<Task>(`/tasks/${encodeURIComponent(ref)}`);
  } catch (error) {
    if (!(error instanceof CliError) || error.code !== 'not_found' || ref.length < 4) {
      throw error;
    }
  }
  const prefix = ref.toLowerCase();
  const candidates = [
    ...await api.get<Task[]>('/tasks'),
    ...await api.get<Task[]>('/tasks?type=completedTodos'),
  ].filter((task) => task.id.startsWith(prefix));
  const [match] = candidates;
  if (!match || candidates.length > 1) {
    throw new CliError(
      'not_found',
      candidates.length > 1 ? `"${ref}" matches ${candidates.length} tasks; use more characters` : `No task "${ref}"`,
      2,
    );
  }
  return match;
}

export async function scoreTask(
  ctx: Context,
  ref: string,
  direction: 'up' | 'down',
): Promise<void> {
  try {
    const target = await loadTask(
      ctx.api,
      ref,
    );
    const result = await ctx.api.post<ScoreResult>(`/tasks/${target.id}/score/${direction}`);
    const task = result.task;
    const state = task.type === 'habit'
      ? `counters +${task.counterUp}/-${task.counterDown}`
      : (task.completed ? 'completed' : 'not completed');
    print(
      ctx.output,
      result,
      () => `${task.text}: ${state}, value ${task.value.toFixed(2)} (${result.delta >= 0 ? '+' : ''}${result.delta.toFixed(2)})`,
    );
  } catch (error) {
    fail(
      ctx.output,
      error,
    );
  }
}
