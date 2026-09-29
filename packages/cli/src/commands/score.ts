import type {
  Task,
} from '@karotto/core';
import type { Argv } from 'yargs';
import { CliError } from '@/client';
import {
  context,
  loadTask,
  scoreTask,
} from '@/context';
import type { Globals } from '@/context';
import {
  fail,
  print,
} from '@/output';

export function registerScore(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'score <task> [direction]',
      'Score a task: complete/uncomplete a daily or to-do, or click a habit',
      (cmd) => cmd
        .positional(
          'task',
          {
            type: 'string',
            demandOption: true,
          },
        )
        .positional(
          'direction',
          {
            type: 'string',
            choices: [
              'up',
              'down',
            ],
            default: 'up',
          },
        ),
      async (argv) => scoreTask(
        context(argv),
        argv.task,
        argv.direction as 'up' | 'down',
      ),
    ).command(
      'done <task>',
      'Mark a daily or to-do complete (alias for score up)',
      (cmd) => cmd.positional(
        'task',
        {
          type: 'string',
          demandOption: true,
        },
      ),
      async (argv) => scoreTask(
        context(argv),
        argv.task,
        'up',
      ),
    ).command(
      'undo <task>',
      'Mark a daily or to-do not complete (alias for score down)',
      (cmd) => cmd.positional(
        'task',
        {
          type: 'string',
          demandOption: true,
        },
      ),
      async (argv) => scoreTask(
        context(argv),
        argv.task,
        'down',
      ),
    ).command(
      'check <task> <item>',
      'Toggle a checklist item by number or text',
      (cmd) => cmd
        .positional(
          'task',
          {
            type: 'string',
            demandOption: true,
          },
        )
        .positional(
          'item',
          {
            type: 'string',
            demandOption: true,
            describe: '1-based position or a unique part of the item text',
          },
        ),
      async (argv) => {
        const ctx = context(argv);
        try {
          const task = await loadTask(
            ctx.api,
            argv.task,
          );
          if (task.type === 'habit') {
            throw new CliError(
              'usage',
              'Habits have no checklist',
              2,
            );
          }
          const index = Number.parseInt(
            argv.item,
            10,
          );
          const matches = Number.isInteger(index) && String(index) === argv.item
            ? [task.checklist[index - 1]].filter((item) => item !== undefined)
            : task.checklist.filter((item) => item.text.toLowerCase().includes(argv.item.toLowerCase()));
          const [item] = matches;
          if (!item || matches.length > 1) {
            throw new CliError(
              'usage',
              matches.length > 1 ? `"${argv.item}" matches ${matches.length} items; be more specific` : `No checklist item "${argv.item}"`,
              2,
            );
          }
          const updated = await ctx.api.post<Task>(`/tasks/${task.id}/checklist/${item.id}/score`);
          const now = updated.type === 'habit' ? undefined : updated.checklist.find((entry) => entry.id === item.id);
          print(
            ctx.output,
            updated,
            () => `${item.text}: ${now?.completed ? 'checked' : 'unchecked'}`,
          );
        } catch (error) {
          fail(
            ctx.output,
            error,
          );
        }
      },
    );
}
