import type {
  Task,
  TaskType,
} from '@karotto/core';
import type { Argv } from 'yargs';
import { CliError } from '@/client';
import {
  context,
  flagsOf,
  loadTask,
  resolveTagIds,
  tagMap,
  taskFlagOptions,
} from '@/context';
import type { Globals } from '@/context';
import {
  fail,
  print,
  shortId,
  table,
  taskDetail,
  taskRows,
} from '@/output';
import { taskBody } from '@/task-input';

export function registerTasks(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'tasks',
      'List, inspect and change tasks',
      (cmd) => cmd
        .command(
          'list',
          'List tasks',
          (sub) => sub
            .option(
              'type',
              {
                type: 'string',
                choices: [
                  'habit',
                  'daily',
                  'todo',
                ],
                alias: 't',
              },
            )
            .option(
              'due',
              {
                type: 'boolean',
                describe: 'Only dailies due today and not yet done',
              },
            )
            .option(
              'completed',
              {
                type: 'boolean',
                describe: 'Completed to-dos instead of active tasks',
              },
            )
            .option(
              'tag',
              {
                type: 'string',
                array: true,
                describe: 'Only tasks carrying all of these tags',
              },
            )
            .option(
              'search',
              {
                type: 'string',
                alias: 's',
                describe: 'Text or notes contain this',
              },
            ),
          async (argv) => {
            const ctx = context(argv);
            try {
              const tags = await tagMap(ctx.api);
              let tasks = await ctx.api.get<Task[]>(argv.completed ? '/tasks?type=completedTodos' : '/tasks');
              if (argv.type) {
                tasks = tasks.filter((task) => task.type === argv.type);
              }
              if (argv.due) {
                tasks = tasks.filter((task) => task.type === 'daily' && task.isDue && !task.completed);
              }
              if (argv.tag?.length) {
                const wanted = argv.tag.map((name) => name.toLowerCase());
                tasks = tasks.filter((task) => wanted.every((name) => task.tags.some((id) => tags.get(id)?.name.toLowerCase() === name)));
              }
              if (argv.search) {
                const needle = argv.search.toLowerCase();
                tasks = tasks.filter((task) => task.text.toLowerCase().includes(needle) || task.notes.toLowerCase().includes(needle));
              }
              print(
                ctx.output,
                tasks,
                () => (tasks.length === 0
                  ? 'No tasks'
                  : table(taskRows(
                      tasks,
                      tags,
                    ))),
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .command(
          'show <task>',
          'Show one task in full',
          (sub) => sub.positional(
            'task',
            {
              type: 'string',
              demandOption: true,
              describe: 'Task id or alias',
            },
          ),
          async (argv) => {
            const ctx = context(argv);
            try {
              const task = await loadTask(
                ctx.api,
                argv.task,
              );
              print(
                ctx.output,
                task,
                () => taskDetail(
                  task,
                  new Map(),
                ),
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .command(
          'add <type> <text>',
          'Create a task',
          (sub) => sub
            .positional(
              'type',
              {
                type: 'string',
                choices: [
                  'habit',
                  'daily',
                  'todo',
                ],
                demandOption: true,
              },
            )
            .positional(
              'text',
              {
                type: 'string',
                demandOption: true,
              },
            )
            .options(taskFlagOptions),
          async (argv) => {
            const ctx = context(argv);
            try {
              const type = argv.type as TaskType;
              const tagIds = argv.tag?.length
                ? await resolveTagIds(
                    ctx.api,
                    argv.tag,
                    true,
                  )
                : undefined;
              const body = {
                type,
                ...taskBody(
                  type,
                  flagsOf(argv),
                  tagIds,
                ),
              };
              const task = await ctx.api.post<Task>(
                '/tasks',
                body,
              );
              print(
                ctx.output,
                task,
                () => `Created ${task.type} ${task.alias ?? shortId(task.id)}: ${task.text}`,
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .command(
          'edit <task>',
          'Change a task\'s fields',
          (sub) => sub
            .positional(
              'task',
              {
                type: 'string',
                demandOption: true,
              },
            )
            .option(
              'text',
              {
                type: 'string',
                describe: 'New title',
              },
            )
            .option(
              'add-tag',
              {
                type: 'string',
                array: true,
                describe: 'Tags to add (created when missing)',
              },
            )
            .option(
              'remove-tag',
              {
                type: 'string',
                array: true,
                describe: 'Tags to remove',
              },
            )
            .options(taskFlagOptions),
          async (argv) => {
            const ctx = context(argv);
            try {
              const current = await loadTask(
                ctx.api,
                argv.task,
              );
              let tagIds: string[] | undefined;
              if (argv.tag?.length) {
                tagIds = await resolveTagIds(
                  ctx.api,
                  argv.tag,
                  true,
                );
              } else if (argv.addTag?.length || argv.removeTag?.length) {
                const added = argv.addTag?.length
                  ? await resolveTagIds(
                      ctx.api,
                      argv.addTag,
                      true,
                    )
                  : [];
                const removed = argv.removeTag?.length
                  ? await resolveTagIds(
                      ctx.api,
                      argv.removeTag,
                      false,
                    )
                  : [];
                tagIds = [
                  ...new Set([
                    ...current.tags.filter((id) => !removed.includes(id)),
                    ...added,
                  ]),
                ];
              }
              const body = taskBody(
                current.type,
                flagsOf(argv),
                tagIds,
              );
              if (Object.keys(body).length === 0) {
                throw new CliError(
                  'usage',
                  'Nothing to change; pass at least one flag',
                  2,
                );
              }
              const task = await ctx.api.patch<Task>(
                `/tasks/${current.id}`,
                body,
              );
              print(
                ctx.output,
                task,
                () => `Updated ${task.alias ?? shortId(task.id)}: ${task.text}`,
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .command(
          'rm <task>',
          'Delete a task',
          (sub) => sub.positional(
            'task',
            {
              type: 'string',
              demandOption: true,
            },
          ),
          async (argv) => {
            const ctx = context(argv);
            try {
              const task = await loadTask(
                ctx.api,
                argv.task,
              );
              await ctx.api.delete(`/tasks/${task.id}`);
              print(
                ctx.output,
                {
                  deleted: task.id,
                  text: task.text,
                },
                () => `Deleted ${task.text}`,
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .command(
          'clear-completed',
          'Delete all completed to-dos',
          () => undefined,
          async (argv) => {
            const ctx = context(argv);
            try {
              const result = await ctx.api.post<{ deleted: number }>('/tasks/clear-completed');
              print(
                ctx.output,
                result,
                () => `Deleted ${result.deleted} completed to-do(s)`,
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .demandCommand(1),
    );
}
