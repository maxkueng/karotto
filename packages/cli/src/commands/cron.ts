import type {
  CronResult,
  CronStatus,
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
    );
}
