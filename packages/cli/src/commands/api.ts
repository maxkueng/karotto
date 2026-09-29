import type { Argv } from 'yargs';
import { context } from '@/context';
import type { Globals } from '@/context';
import { fail } from '@/output';

export function registerApi(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'api <method> <path>',
      'Call any endpoint under /api/v1 (escape hatch)',
      (cmd) => cmd
        .positional(
          'method',
          {
            type: 'string',
            choices: [
              'GET',
              'POST',
              'PATCH',
              'PUT',
              'DELETE',
            ],
            demandOption: true,
          },
        )
        .positional(
          'path',
          {
            type: 'string',
            demandOption: true,
            describe: 'e.g. /tasks?type=completedTodos',
          },
        )
        .option(
          'data',
          {
            type: 'string',
            alias: 'd',
            describe: 'JSON request body',
          },
        ),
      async (argv) => {
        const ctx = context(argv);
        try {
          const body = argv.data === undefined ? undefined : JSON.parse(argv.data) as unknown;
          const result = await ctx.api.request<unknown>(
            argv.method as 'GET',
            argv.path,
            body,
          );
          process.stdout.write(`${JSON.stringify(
            result,
            null,
            2,
          )}\n`);
        } catch (error) {
          fail(
            ctx.output,
            error,
          );
        }
      },
    );
}
