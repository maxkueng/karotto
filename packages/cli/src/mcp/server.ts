import type {
  User,
  CronResult,
  CronStatus,
  ScoreResult,
  Tag,
  Task,
} from '@karotto/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CliError } from '@/client';
import type { ApiClient } from '@/client';
import {
  loadTask,
  resolveTagIds,
  tagMap,
} from '@/context';
import { taskBody } from '@/task-input';

const taskRef = z.string().min(1).describe('Task alias, id, or unique id prefix');

const scheduleFields = {
  notes: z.string().optional().describe('Markdown notes'),
  alias: z.string().nullable().optional().describe('Short handle usable instead of the id; null clears'),
  tags: z.array(z.string()).optional().describe('Tag names; created when missing. On update this replaces all tags'),
  checklist: z.array(z.string()).optional().describe('Checklist item texts (dailies and to-dos). On update this replaces the list'),
  due: z.string().nullable().optional().describe('To-do due date YYYY-MM-DD; null clears'),
  start: z.string().optional().describe('Daily schedule start date YYYY-MM-DD'),
  frequency: z.enum([
    'daily',
    'weekly',
    'monthly',
    'yearly',
  ]).optional().describe('Daily schedule unit; weekly by default'),
  every: z.number().int().min(1).optional().describe('Daily: repeat every N units'),
  repeat: z.string().optional().describe('Daily: weekdays such as "mon,wed,fri" or "all"'),
  up: z.boolean().optional().describe('Habit: allow positive clicks'),
  down: z.boolean().optional().describe('Habit: allow negative clicks'),
  reset: z.enum([
    'daily',
    'weekly',
    'monthly',
  ]).optional().describe('Habit: when counters reset'),
  streak: z.number().int().min(0).optional().describe('Daily: set the streak'),
};

type ScheduleInput = {
  [K in keyof typeof scheduleFields]?: z.infer<(typeof scheduleFields)[K]>;
};

function flagsFrom(input: ScheduleInput) {
  return {
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.alias !== undefined ? { alias: input.alias === null ? '' : input.alias } : {}),
    ...(input.checklist !== undefined ? { checklist: input.checklist } : {}),
    ...(input.due !== undefined ? { due: input.due === null ? '' : input.due } : {}),
    ...(input.start !== undefined ? { start: input.start } : {}),
    ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
    ...(input.every !== undefined ? { every: input.every } : {}),
    ...(input.repeat !== undefined ? { repeat: input.repeat } : {}),
    ...(input.up !== undefined ? { up: input.up } : {}),
    ...(input.down !== undefined ? { down: input.down } : {}),
    ...(input.reset !== undefined ? { reset: input.reset } : {}),
    ...(input.streak !== undefined ? { streak: input.streak } : {}),
  };
}

type ToolResult = {
  content: {
    type: 'text';
    text: string;
  }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data),
      },
    ],
    structuredContent: Array.isArray(data) ? { items: data } : data as Record<string, unknown>,
  };
}

function failure(error: unknown): ToolResult {
  const cliError = error instanceof CliError
    ? error
    : new CliError(
        'error',
        error instanceof Error ? error.message : String(error),
      );
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: {
            code: cliError.code,
            message: cliError.message,
          },
        }),
      },
    ],
    isError: true,
  };
}

async function guarded(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await fn());
  } catch (error) {
    return failure(error);
  }
}

/** Trims task JSON to what a model needs; tags are resolved to names. */
function compact(
  task: Task,
  tags: Map<string, Tag>,
): Record<string, unknown> {
  const base = {
    id: task.id,
    alias: task.alias,
    type: task.type,
    text: task.text,
    notes: task.notes,
    value: Math.round(task.value * 100) / 100,
    tags: task.tags.map((id) => tags.get(id)?.name ?? id),
  };
  switch (task.type) {
    case 'habit':
      return {
        ...base,
        up: task.up,
        down: task.down,
        counterUp: task.counterUp,
        counterDown: task.counterDown,
      };
    case 'daily':
      return {
        ...base,
        completed: task.completed,
        isDue: task.isDue,
        streak: task.streak,
        frequency: task.frequency,
        everyX: task.everyX,
        startDate: task.startDate,
        repeat: Object.entries(task.repeat).filter(([
          ,
          on,
        ]) => on).map(([day]) => day),
        checklist: task.checklist,
      };
    case 'todo':
      return {
        ...base,
        completed: task.completed,
        dueDate: task.dueDate,
        checklist: task.checklist,
      };
  }
}

export function buildMcpServer(api: ApiClient): McpServer {
  const server = new McpServer({
    name: 'karotto',
    version: '0.1.0',
  });

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description: 'List the user\'s tasks. Dailies include isDue for the current day. Use due=true for today\'s unfinished dailies, completed=true for finished to-dos.',
      inputSchema: {
        type: z.enum([
          'habit',
          'daily',
          'todo',
        ]).optional(),
        due: z.boolean().optional().describe('Only dailies due today and not yet completed'),
        completed: z.boolean().optional().describe('Completed to-dos instead of active tasks'),
        tag: z.string().optional().describe('Only tasks carrying this tag name'),
        search: z.string().optional().describe('Text or notes contain this'),
      },
    },
    async (input) => guarded(async () => {
      const tags = await tagMap(api);
      let tasks = await api.get<Task[]>(input.completed ? '/tasks?type=completedTodos' : '/tasks');
      if (input.type) {
        tasks = tasks.filter((task) => task.type === input.type);
      }
      if (input.due) {
        tasks = tasks.filter((task) => task.type === 'daily' && task.isDue && !task.completed);
      }
      if (input.tag) {
        const wanted = input.tag.toLowerCase();
        tasks = tasks.filter((task) => task.tags.some((id) => tags.get(id)?.name.toLowerCase() === wanted));
      }
      if (input.search) {
        const needle = input.search.toLowerCase();
        tasks = tasks.filter((task) => task.text.toLowerCase().includes(needle) || task.notes.toLowerCase().includes(needle));
      }
      return tasks.map((task) => compact(
        task,
        tags,
      ));
    }),
  );

  server.registerTool(
    'get_task',
    {
      title: 'Get a task',
      description: 'Full detail of one task, including checklist and schedule.',
      inputSchema: { task: taskRef },
    },
    async (input) => guarded(async () => compact(
      await loadTask(
        api,
        input.task,
      ),
      await tagMap(api),
    )),
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create a task',
      description: 'Create a habit, daily or to-do. Dailies default to weekly on every day from today; pass repeat to limit weekdays.',
      inputSchema: {
        type: z.enum([
          'habit',
          'daily',
          'todo',
        ]),
        text: z.string().min(1).describe('Title, markdown allowed'),
        ...scheduleFields,
      },
    },
    async (input) => guarded(async () => {
      const tagIds = input.tags?.length
        ? await resolveTagIds(
            api,
            input.tags,
            true,
          )
        : undefined;
      const task = await api.post<Task>(
        '/tasks',
        {
          type: input.type,
          text: input.text,
          ...taskBody(
            input.type,
            flagsFrom(input),
            tagIds,
          ),
        },
      );
      return compact(
        task,
        await tagMap(api),
      );
    }),
  );

  server.registerTool(
    'update_task',
    {
      title: 'Update a task',
      description: 'Change fields of an existing task. Only the fields given are changed; tags and checklist, when given, replace the existing ones.',
      inputSchema: {
        task: taskRef,
        text: z.string().min(1).optional(),
        ...scheduleFields,
      },
    },
    async (input) => guarded(async () => {
      const current = await loadTask(
        api,
        input.task,
      );
      const tagIds = input.tags !== undefined
        ? await resolveTagIds(
            api,
            input.tags,
            true,
          )
        : undefined;
      const body = taskBody(
        current.type,
        {
          ...(input.text !== undefined ? { text: input.text } : {}),
          ...flagsFrom(input),
        },
        tagIds,
      );
      if (Object.keys(body).length === 0) {
        throw new CliError(
          'usage',
          'Nothing to change',
          2,
        );
      }
      const task = await api.patch<Task>(
        `/tasks/${current.id}`,
        body,
      );
      return compact(
        task,
        await tagMap(api),
      );
    }),
  );

  server.registerTool(
    'delete_task',
    {
      title: 'Delete a task',
      description: 'Permanently delete a task. Confirm with the user first.',
      inputSchema: { task: taskRef },
    },
    async (input) => guarded(async () => {
      const task = await loadTask(
        api,
        input.task,
      );
      await api.delete(`/tasks/${task.id}`);
      return {
        deleted: task.id,
        text: task.text,
      };
    }),
  );

  server.registerTool(
    'score_task',
    {
      title: 'Score a task',
      description: 'Complete (up) or un-complete (down) a daily or to-do, or record a habit click. Not idempotent: completing an already completed task fails, every habit click counts. Run cron_status first when the app has not been opened today.',
      inputSchema: {
        task: taskRef,
        direction: z.enum([
          'up',
          'down',
        ]).default('up'),
      },
    },
    async (input) => guarded(async () => {
      const task = await loadTask(
        api,
        input.task,
      );
      const result = await api.post<ScoreResult>(`/tasks/${task.id}/score/${input.direction}`);
      return {
        task: compact(
          result.task,
          await tagMap(api),
        ),
        delta: Math.round(result.delta * 100) / 100,
      };
    }),
  );

  server.registerTool(
    'toggle_checklist_item',
    {
      title: 'Toggle a checklist item',
      description: 'Check or uncheck one checklist item of a daily or to-do, by 1-based position or a unique part of its text.',
      inputSchema: {
        task: taskRef,
        item: z.string().min(1).describe('1-based position or text fragment'),
      },
    },
    async (input) => guarded(async () => {
      const task = await loadTask(
        api,
        input.task,
      );
      if (task.type === 'habit') {
        throw new CliError(
          'usage',
          'Habits have no checklist',
          2,
        );
      }
      const index = Number.parseInt(
        input.item,
        10,
      );
      const matches = String(index) === input.item
        ? [task.checklist[index - 1]].filter((item) => item !== undefined)
        : task.checklist.filter((item) => item.text.toLowerCase().includes(input.item.toLowerCase()));
      const [item] = matches;
      if (!item || matches.length > 1) {
        throw new CliError(
          'usage',
          matches.length > 1 ? `"${input.item}" matches ${matches.length} items` : `No checklist item "${input.item}"`,
          2,
        );
      }
      const updated = await api.post<Task>(`/tasks/${task.id}/checklist/${item.id}/score`);
      return compact(
        updated,
        await tagMap(api),
      );
    }),
  );

  server.registerTool(
    'list_tags',
    {
      title: 'List tags',
      description: 'All of the user\'s tags.',
      inputSchema: {},
    },
    async () => guarded(async () => (await api.get<Tag[]>('/tags')).map((tag) => ({
      id: tag.id,
      name: tag.name,
    }))),
  );

  server.registerTool(
    'create_tag',
    {
      title: 'Create a tag',
      description: 'Create a tag; names are unique per user, ignoring case.',
      inputSchema: { name: z.string().min(1) },
    },
    async (input) => guarded(async () => api.post<Tag>(
      '/tags',
      { name: input.name },
    )),
  );

  server.registerTool(
    'rename_tag',
    {
      title: 'Rename a tag',
      description: 'Rename an existing tag.',
      inputSchema: {
        name: z.string().min(1),
        newName: z.string().min(1),
      },
    },
    async (input) => guarded(async () => {
      const [id] = await resolveTagIds(
        api,
        [input.name],
        false,
      );
      return api.patch<Tag>(
        `/tags/${id}`,
        { name: input.newName },
      );
    }),
  );

  server.registerTool(
    'delete_tag',
    {
      title: 'Delete a tag',
      description: 'Delete a tag and remove it from every task. Confirm with the user first.',
      inputSchema: { name: z.string().min(1) },
    },
    async (input) => guarded(async () => {
      const [id] = await resolveTagIds(
        api,
        [input.name],
        false,
      );
      await api.delete(`/tags/${id}`);
      return { deleted: id };
    }),
  );

  server.registerTool(
    'cron_status',
    {
      title: 'Day rollover status',
      description: 'Whether a day rollover is pending, and which of yesterday\'s due dailies were not completed. Call this before scoring when the app may not have been opened today.',
      inputSchema: {},
    },
    async () => guarded(async () => {
      const status = await api.get<CronStatus>('/cron/status');
      const tags = await tagMap(api);
      return {
        needsCron: status.needsCron,
        daysMissed: status.daysMissed,
        yesterday: status.yesterday,
        yesterdailies: status.yesterdailies.map((task) => compact(
          task,
          tags,
        )),
      };
    }),
  );

  server.registerTool(
    'run_cron',
    {
      title: 'Run the day rollover',
      description: 'Run the rollover, optionally completing the listed dailies for yesterday first. Safe when nothing is pending (ran: false).',
      inputSchema: {
        done: z.array(taskRef).optional().describe('Dailies that were done yesterday'),
      },
    },
    async (input) => guarded(async () => {
      const scores = [];
      for (const ref of input.done ?? []) {
        scores.push({
          id: (await loadTask(
            api,
            ref,
          )).id,
          direction: 'up',
        });
      }
      const result = await api.post<CronResult>(
        '/cron',
        scores.length ? { scores } : undefined,
      );
      return {
        ran: result.ran,
        daysMissed: result.daysMissed,
      };
    }),
  );

  server.registerTool(
    'set_paused',
    {
      title: 'Pause or resume (vacation mode)',
      description: 'While paused, days still roll over but missed dailies keep their streak and value and to-dos do not decay.',
      inputSchema: { paused: z.boolean() },
    },
    async (input) => guarded(async () => {
      const user = await api.patch<User>(
        '/user/preferences',
        { paused: input.paused },
      );
      return { paused: user.preferences.paused };
    }),
  );

  return server;
}

export async function serveStdio(api: ApiClient): Promise<void> {
  const server = buildMcpServer(api);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
