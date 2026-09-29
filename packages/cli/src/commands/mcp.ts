import type { Argv } from 'yargs';
import { context } from '@/context';
import type { Globals } from '@/context';
import { serveStdio } from '@/mcp/server';
import { fail } from '@/output';

export function registerMcp(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'mcp',
      'Run a Model Context Protocol server over stdio for AI agents',
      () => undefined,
      async (argv) => {
        const ctx = context(argv);
        try {
          await serveStdio(ctx.api);
        } catch (error) {
          fail(
            ctx.output,
            error,
          );
        }
      },
    );
}
