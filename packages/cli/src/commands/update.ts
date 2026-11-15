import { API_REVISION } from '@karotto/core';
import type { Argv } from 'yargs';
import {
  ApiClient,
  CliError,
} from '@/client';
import { resolveConnection } from '@/config';
import type { Globals } from '@/context';
import {
  fail,
  print,
} from '@/output';
import type { Output } from '@/output';
import {
  fetchReleases,
  installPath,
  installUpdate,
  planUpdate,
  writeCheckCache,
} from '@/update';
import type { Plan } from '@/update';
import {
  standalone,
  version,
} from '@/version';

export function registerUpdate(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'update',
      'Install the newest karotto release that works with your server',
      (cmd) => cmd.option(
        'check',
        {
          type: 'boolean',
          default: false,
          describe: 'Only report what an update would do',
        },
      ),
      async (argv) => {
        const output: Output = { json: argv.json };
        try {
          await update(
            output,
            argv.url,
            argv.check,
          );
        } catch (error) {
          fail(
            output,
            error,
          );
        }
      },
    );
}

async function update(
  output: Output,
  url: string | undefined,
  checkOnly: boolean,
): Promise<void> {
  if (!standalone) {
    throw new CliError(
      'not_updatable',
      'Only the standalone karotto executable updates itself; update this one the way it was installed',
      2,
    );
  }
  const serverRevision = await askServerRevision(url);
  const releases = await fetchReleases();
  writeCheckCache({
    checkedAt: Date.now(),
    releases,
  });
  const plan = planUpdate(
    releases,
    {
      version,
      requiresApi: API_REVISION,
    },
    serverRevision,
  );
  if (plan.action === 'unsupported_server') {
    throw new CliError(
      'unsupported_server',
      `No karotto release works with this server (API revision ${serverRevision}); the server needs an update`,
    );
  }
  if (plan.action === 'current' || checkOnly) {
    print(
      output,
      describe(
        plan,
        serverRevision,
      ),
      () => checkMessage(
        plan,
        serverRevision,
      ),
    );
    return;
  }
  const target = installPath();
  await installUpdate(
    plan.release,
    target,
  );
  print(
    output,
    {
      ...describe(
        plan,
        serverRevision,
      ),
      path: target,
    },
    () => `${plan.downgrade ? 'Downgraded' : 'Updated'} karotto ${version} -> ${plan.release.version} (${target})`,
  );
}

/** No configured server means nothing to stay compatible with. */
async function askServerRevision(url: string | undefined): Promise<number | null> {
  const connection = resolveConnection(url);
  if (!connection.url) {
    return null;
  }
  const api = new ApiClient(
    connection.url,
    connection.token,
  );
  await api.get('/health');
  return api.serverRevision;
}

function describe(
  plan: Plan,
  serverRevision: number | null,
) {
  return {
    current: version,
    serverApiRevision: serverRevision,
    action: plan.action === 'install' ? (plan.downgrade ? 'downgrade' : 'update') : 'none',
    target: plan.action === 'install' ? plan.release.version : null,
  };
}

function checkMessage(
  plan: Plan,
  serverRevision: number | null,
): string {
  const server = serverRevision === null ? '' : ' for this server';
  if (plan.action !== 'install') {
    return `karotto ${version} is up to date${server}`;
  }
  return plan.downgrade
    ? `This karotto needs a newer server than API revision ${serverRevision}; karotto ${plan.release.version} is the newest release that fits it. Run \`karotto update\` to switch.`
    : `karotto ${plan.release.version} is available${server} (you have ${version}). Run \`karotto update\`.`;
}
