import yargs from 'yargs';
import type { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CliError } from '@/client';
import { registerApi } from '@/commands/api';
import { registerAuth } from '@/commands/auth';
import { registerCron } from '@/commands/cron';
import { registerEvents } from '@/commands/events';
import { registerMcp } from '@/commands/mcp';
import { registerScore } from '@/commands/score';
import { registerTags } from '@/commands/tags';
import { registerTasks } from '@/commands/tasks';
import type { Globals } from '@/context';
import { fail } from '@/output';
import type { Output } from '@/output';

const parser: Argv<Globals> = yargs(hideBin(process.argv))
  .scriptName('karotto')
  .usage('$0 <command> [options]\n\nCommand-line client for karotto. Configure with `karotto login` or KAROTTO_URL and KAROTTO_TOKEN.')
  .option(
    'json',
    {
      type: 'boolean',
      default: false,
      describe: 'Machine-readable output (errors go to stderr as JSON)',
      global: true,
    },
  )
  .option(
    'url',
    {
      type: 'string',
      describe: 'Server URL, overriding the stored one',
      global: true,
    },
  );

const registered = [
  registerAuth,
  registerTasks,
  registerScore,
  registerTags,
  registerCron,
  registerEvents,
  registerMcp,
  registerApi,
].reduce(
  (
    current,
    register,
  ) => register(current),
  parser,
);

await registered
  .demandCommand(
    1,
    'Give a command; try --help',
  )
  .strict()
  .fail((
    message,
    error,
  ) => {
    const output: Output = { json: process.argv.includes('--json') };
    if (error) {
      fail(
        output,
        error,
      );
    }
    fail(
      output,
      new CliError(
        'usage',
        `${message}. Try --help.`,
        2,
      ),
    );
  })
  .help()
  .wrap(Math.min(
    100,
    process.stdout.columns ?? 100,
  ))
  .parseAsync();
