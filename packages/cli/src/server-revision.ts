import { API_REVISION } from '@karotto/core';
import type { Output } from '@/output';

let observed: number | null = null;

export function observeServerRevision(
  revision: number,
  output: Output,
): void {
  if (observed !== null) {
    return;
  }
  observed = revision;
  if (revision < API_REVISION && !output.json) {
    process.stderr.write(`karotto: the server speaks API revision ${revision}, this karotto needs ${API_REVISION}. Newer commands and options may fail or be ignored until the server is updated; \`karotto update\` installs a release that fits it.\n`);
  }
}

export function observedServerRevision(): number | null {
  return observed;
}
