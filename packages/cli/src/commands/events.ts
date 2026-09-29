import type { Argv } from 'yargs';
import { CliError } from '@/client';
import { context } from '@/context';
import type { Globals } from '@/context';
import { fail } from '@/output';

export function registerEvents(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'events',
      'Stream live changes as JSON lines until interrupted',
      () => undefined,
      async (argv) => {
        const ctx = context(argv);
        try {
          const response = await fetch(
            ctx.api.url('/events'),
            {
              headers: {
                ...ctx.api.headers(),
                accept: 'text/event-stream',
              },
            },
          );
          if (!response.ok || !response.body) {
            throw new CliError(
              `http_${response.status}`,
              `Event stream refused: ${response.statusText}`,
              response.status === 401 ? 3 : 1,
            );
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) {
              break;
            }
            buffer += decoder.decode(
              chunk.value,
              { stream: true },
            );
            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
              const frame = buffer.slice(
                0,
                boundary,
              );
              buffer = buffer.slice(boundary + 2);
              const data = frame.split('\n').find((line) => line.startsWith('data: '));
              if (data) {
                process.stdout.write(`${data.slice(6)}\n`);
              }
              boundary = buffer.indexOf('\n\n');
            }
          }
        } catch (error) {
          fail(
            ctx.output,
            error,
          );
        }
      },
    );
}
