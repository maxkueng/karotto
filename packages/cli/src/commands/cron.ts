import type {
  CronResult,
  CronStatus,
  User,
} from '@karotto/core';
import type { Argv } from 'yargs';
import {
  context,
  loadTask,
} from '@/context';
import type { Globals } from '@/context';
import {
  fail,
  print,
  shortId,
} from '@/output';

export function registerCron(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'cron',
      'Day rollover',
      (cmd) => cmd
        .command(
          'status',
          'Whether a rollover is pending and which dailies were due yesterday',
          () => undefined,
          async (argv) => {
            const ctx = context(argv);
            try {
              const status = await ctx.api.get<CronStatus>('/cron/status');
              print(
                ctx.output,
                status,
                () => (status.needsCron
                  ? `Rollover pending (${status.daysMissed} day(s) since last). Yesterday's unfinished dailies:\n${status.yesterdailies.map((task) => `  ${task.alias ?? shortId(task.id)}  ${task.text}`).join('\n') || '  none'}`
                  : 'Up to date'),
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
          'run',
          'Run the rollover, optionally completing yesterday\'s dailies first',
          (sub) => sub.option(
            'done',
            {
              type: 'string',
              array: true,
              describe: 'Ids or aliases of dailies that were done yesterday',
            },
          ),
          async (argv) => {
            const ctx = context(argv);
            try {
              const scores = [];
              for (const ref of argv.done ?? []) {
                scores.push({
                  id: (await loadTask(
                    ctx.api,
                    ref,
                  )).id,
                  direction: 'up',
                });
              }
              const result = await ctx.api.post<CronResult>(
                '/cron',
                scores.length ? { scores } : undefined,
              );
              print(
                ctx.output,
                result,
                () => (result.ran ? `Rolled over ${result.daysMissed} day(s)` : 'Nothing to roll over'),
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
    )
    .command(
      'pause',
      'Vacation mode: days still roll over, but missed dailies and to-dos are not penalised',
      () => undefined,
      async (argv) => setPaused(
        argv,
        true,
      ),
    )
    .command(
      'resume',
      'Leave vacation mode',
      () => undefined,
      async (argv) => setPaused(
        argv,
        false,
      ),
    );
}

async function setPaused(
  argv: Globals,
  paused: boolean,
): Promise<void> {
  const ctx = context(argv);
  try {
    const user = await ctx.api.patch<User>(
      '/user/preferences',
      { paused },
    );
    print(
      ctx.output,
      { paused: user.preferences.paused },
      () => (user.preferences.paused ? 'Paused. Rollovers will not penalise anything until you resume.' : 'Resumed.'),
    );
  } catch (error) {
    fail(
      ctx.output,
      error,
    );
  }
}
