import type {
  User,
} from '@karotto/core';
import type { Argv } from 'yargs';
import {
  ApiClient,
  CliError,
} from '@/client';
import {
  clearStoredConfig,
  configPath,
  resolveConnection,
  writeStoredConfig,
} from '@/config';
import {
  context,
  readSecret,
} from '@/context';
import type { Globals } from '@/context';
import {
  fail,
  print,
  table,
} from '@/output';
import type { Output } from '@/output';

export function registerAuth(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'login',
      'Create an API token for this machine and store it',
      (cmd) => cmd
        .option(
          'url',
          {
            type: 'string',
            describe: 'Server URL, e.g. https://karotto.example.ts.net',
          },
        )
        .option(
          'username',
          {
            type: 'string',
            alias: 'u',
            demandOption: true,
          },
        )
        .option(
          'name',
          {
            type: 'string',
            default: 'karotto',
            describe: 'Token name shown in Settings',
          },
        )
        .option(
          'password-stdin',
          {
            type: 'boolean',
            default: false,
            describe: 'Read the password from stdin',
          },
        ),
      async (argv) => {
        const output: Output = { json: argv.json };
        try {
          const url = (argv.url ?? resolveConnection().url).replace(
            /\/+$/,
            '',
          );
          if (!url) {
            throw new CliError(
              'usage',
              'Pass --url on first login',
              2,
            );
          }
          const password = argv.passwordStdin ? await readSecret('') : await readSecret('Password: ');
          const api = new ApiClient(
            url,
            null,
          );
          const created = await api.post<{ token: string }>(
            '/auth/token',
            {
              username: argv.username,
              password,
              name: argv.name,
            },
          );
          const path = writeStoredConfig({
            url,
            token: created.token,
            username: argv.username,
          });
          print(
            output,
            {
              url,
              username: argv.username,
              configPath: path,
            },
            () => `Logged in to ${url} as ${argv.username}; token stored in ${path}`,
          );
        } catch (error) {
          fail(
            output,
            error,
          );
        }
      },
    ).command(
      'logout',
      'Forget the stored server and token',
      () => undefined,
      (argv) => {
        const removed = clearStoredConfig();
        print(
          { json: argv.json },
          { removed },
          () => (removed ? `Removed ${configPath()}` : 'Nothing stored'),
        );
      },
    ).command(
      'whoami',
      'Show the signed-in user and preferences',
      () => undefined,
      async (argv) => {
        const ctx = context(argv);
        try {
          const user = await ctx.api.get<User>('/user');
          print(
            ctx.output,
            user,
            () => table([
              [
                'username',
                user.username,
              ],
              [
                'timezone',
                user.preferences.timezone,
              ],
              [
                'paused',
                user.preferences.paused ? 'yes' : 'no',
              ],
              [
                'day start',
                `${String(user.preferences.dayStart).padStart(
                  2,
                  '0',
                )}:00`,
              ],
              [
                'needs cron',
                user.needsCron ? 'yes' : 'no',
              ],
            ]),
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
