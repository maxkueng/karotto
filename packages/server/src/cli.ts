import { stdin } from 'node:process';
import {
  createInterface,
} from 'node:readline/promises';
import {
  passwordSchema,
  timezoneSchema,
  usernameSchema,
} from '@karotto/core';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  loadConfig,
  loadDotEnv,
} from '@/config';
import { createDb } from '@/db/client';
import type { DbHandle } from '@/db/client';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from '@/services/apiTokens';
import {
  createUser,
  deleteUser,
  findUserByUsername,
  listUsers,
  setPassword,
} from '@/services/users';

async function readPassword(prompt: string): Promise<string> {
  const muted = stdin.isTTY;
  if (muted) {
    process.stdout.write(prompt);
    stdin.setRawMode(true);
  }
  let value = '';
  if (muted) {
    value = await new Promise<string>((resolve) => {
      let buffer = '';
      const onData = (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        for (const char of text) {
          if (char === '\n' || char === '\r') {
            stdin.off(
              'data',
              onData,
            );
            stdin.setRawMode(false);
            process.stdout.write('\n');
            resolve(buffer);
            return;
          }
          if (char === '\u0003') {
            process.exit(130);
          }
          if (char === '\u007f' || char === '\b') {
            buffer = buffer.slice(
              0,
              -1,
            );
          } else {
            buffer += char;
          }
        }
      };
      stdin.on(
        'data',
        onData,
      );
    });
  } else {
    const rl = createInterface({
      input: stdin,
      output: process.stdout,
    });
    value = (await rl.question(prompt)).trim();
    rl.close();
  }
  return value;
}

async function readPasswordFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8').replace(
    /\r?\n$/,
    '',
  );
}

async function obtainPassword(fromStdin: boolean): Promise<string> {
  const password = fromStdin ? await readPasswordFromStdin() : await readPassword('Password: ');
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    throw new Error('Password must be between 8 and 256 characters');
  }
  if (!fromStdin) {
    const confirm = await readPassword('Confirm password: ');
    if (confirm !== password) {
      throw new Error('Passwords do not match');
    }
  }
  return parsed.data;
}

async function withDb<T>(fn: (handle: DbHandle) => Promise<T>): Promise<T> {
  loadDotEnv();
  const config = loadConfig();
  const handle = createDb(
    config.DATABASE_URL,
    config.MIGRATIONS_DIR,
  );
  try {
    return await fn(handle);
  } finally {
    await handle.close();
  }
}

async function requireUser(
  handle: DbHandle,
  username: string,
) {
  const user = await findUserByUsername(
    handle.db,
    username,
  );
  if (!user) {
    throw new Error(`No such user: ${username}`);
  }
  return user;
}

await yargs(hideBin(process.argv))
  .scriptName('karotto-admin')
  .command(
    'migrate',
    'Apply pending database migrations',
    () => undefined,
    async () => {
      await withDb(async (handle) => {
        await handle.migrate();
        console.log('Migrations applied');
      });
    },
  )
  .command(
    'user',
    'Manage users',
    (cmd) => cmd
      .command(
        'create <username>',
        'Create a user',
        (sub) => sub
          .positional(
            'username',
            {
              type: 'string',
              demandOption: true,
            },
          )
          .option(
            'password-stdin',
            {
              type: 'boolean',
              default: false,
              describe: 'Read the password from stdin instead of prompting',
            },
          )
          .option(
            'timezone',
            {
              type: 'string',
              default: 'UTC',
            },
          ),
        async (argv) => {
          const username = usernameSchema.parse(argv.username);
          const timezone = timezoneSchema.parse(argv.timezone);
          const password = await obtainPassword(argv.passwordStdin);
          await withDb(async (handle) => {
            const user = await createUser(
              handle.db,
              {
                username,
                password,
                timezone,
              },
            );
            console.log(`Created user ${user.username} (${user.id})`);
          });
        },
      )
      .command(
        'list',
        'List users',
        () => undefined,
        async () => {
          await withDb(async (handle) => {
            const rows = await listUsers(handle.db);
            rows.forEach((row) => console.log(`${row.id}\t${row.username}\t${row.timezone}\tdayStart=${row.dayStart}`));
          });
        },
      )
      .command(
        'password <username>',
        'Set a new password',
        (sub) => sub
          .positional(
            'username',
            {
              type: 'string',
              demandOption: true,
            },
          )
          .option(
            'password-stdin',
            {
              type: 'boolean',
              default: false,
            },
          ),
        async (argv) => {
          const password = await obtainPassword(argv.passwordStdin);
          await withDb(async (handle) => {
            const user = await requireUser(
              handle,
              argv.username,
            );
            await setPassword(
              handle.db,
              user.id,
              password,
            );
            console.log(`Password updated for ${user.username}`);
          });
        },
      )
      .command(
        'delete <username>',
        'Delete a user and all their data',
        (sub) => sub.positional(
          'username',
          {
            type: 'string',
            demandOption: true,
          },
        ),
        async (argv) => {
          await withDb(async (handle) => {
            const user = await requireUser(
              handle,
              argv.username,
            );
            await deleteUser(
              handle.db,
              user.id,
            );
            console.log(`Deleted ${user.username}`);
          });
        },
      )
      .demandCommand(1),
    () => undefined,
  )
  .command(
    'token',
    'Manage API tokens',
    (cmd) => cmd
      .command(
        'create <username>',
        'Create a long-lived API token',
        (sub) => sub
          .positional(
            'username',
            {
              type: 'string',
              demandOption: true,
            },
          )
          .option(
            'name',
            {
              type: 'string',
              demandOption: true,
              describe: 'Label for the token',
            },
          )
          .option(
            'expires',
            {
              type: 'string',
              describe: 'ISO datetime after which the token stops working',
            },
          ),
        async (argv) => {
          await withDb(async (handle) => {
            const user = await requireUser(
              handle,
              argv.username,
            );
            const created = await createApiToken(
              handle.db,
              {
                userId: user.id,
                name: argv.name,
                expiresAt: argv.expires ? new Date(argv.expires) : null,
                now: new Date(),
              },
            );
            console.log(`Token ${created.id} (${created.name}) for ${user.username}:`);
            console.log(created.token);
            console.log('It will not be shown again.');
          });
        },
      )
      .command(
        'list <username>',
        'List API tokens',
        (sub) => sub.positional(
          'username',
          {
            type: 'string',
            demandOption: true,
          },
        ),
        async (argv) => {
          await withDb(async (handle) => {
            const user = await requireUser(
              handle,
              argv.username,
            );
            const tokens = await listApiTokens(
              handle.db,
              user.id,
            );
            tokens.forEach((token) => console.log(`${token.id}\t${token.prefix}…\t${token.name}\tlast used ${token.lastUsedAt ?? 'never'}`));
          });
        },
      )
      .command(
        'revoke <username> <id>',
        'Revoke an API token',
        (sub) => sub
          .positional(
            'username',
            {
              type: 'string',
              demandOption: true,
            },
          )
          .positional(
            'id',
            {
              type: 'string',
              demandOption: true,
            },
          ),
        async (argv) => {
          await withDb(async (handle) => {
            const user = await requireUser(
              handle,
              argv.username,
            );
            await revokeApiToken(
              handle.db,
              user.id,
              argv.id,
            );
            console.log('Token revoked');
          });
        },
      )
      .demandCommand(1),
    () => undefined,
  )
  .demandCommand(1)
  .strict()
  .help()
  .parse();
