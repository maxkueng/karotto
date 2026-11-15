import type { Argv } from 'yargs';
import { CliError } from '@/client';
import type { Globals } from '@/context';
import {
  fail,
  print,
} from '@/output';
import type { Output } from '@/output';
import {
  availableMessage,
  compareVersions,
  fetchLatest,
  installPath,
  installUpdate,
  writeCheckCache,
} from '@/update';
import {
  standalone,
  version,
} from '@/version';

export function registerUpdate(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'update',
      'Replace this karotto executable with the newest release',
      (cmd) => cmd.option(
        'check',
        {
          type: 'boolean',
          default: false,
          describe: 'Only report whether an update is available',
        },
      ),
      async (argv) => {
        const output: Output = { json: argv.json };
        try {
          await update(
            output,
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
  checkOnly: boolean,
): Promise<void> {
  if (!standalone) {
    throw new CliError(
      'not_updatable',
      'Only the standalone karotto executable updates itself; update this one the way it was installed',
      2,
    );
  }
  const latest = await fetchLatest();
  writeCheckCache({
    checkedAt: Date.now(),
    latestVersion: latest.version,
  });
  const available = compareVersions(
    latest.version,
    version,
  ) > 0;
  if (!available || checkOnly) {
    print(
      output,
      {
        current: version,
        latest: latest.version,
        updateAvailable: available,
      },
      () => (available
        ? availableMessage(
            latest.version,
            version,
          )
        : `karotto ${version} is up to date`),
    );
    return;
  }
  const target = installPath();
  await installUpdate(
    latest,
    target,
  );
  print(
    output,
    {
      previous: version,
      current: latest.version,
      path: target,
    },
    () => `Updated karotto ${version} -> ${latest.version} (${target})`,
  );
}
