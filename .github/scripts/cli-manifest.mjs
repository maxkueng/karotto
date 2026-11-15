import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
} from 'node:fs';

const [
  manifestPath,
  binaryPath,
  revisionPath,
  version,
] = process.argv.slice(2);

const parts = (entry) => entry.version.split('.').map(Number);
const byVersion = (
  a,
  b,
) => parts(a).reduce(
  (
    order,
    part,
    index,
  ) => order || part - parts(b)[index],
  0,
);

const releases = JSON.parse(readFileSync(
  manifestPath,
  'utf8',
))
  .filter((entry) => entry.version !== version)
  .concat({
    version,
    sha256: createHash('sha256').update(readFileSync(binaryPath)).digest('hex'),
    requiresApi: JSON.parse(readFileSync(
      revisionPath,
      'utf8',
    )).revision,
  })
  .sort(byVersion);

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    releases,
    null,
    2,
  )}\n`,
);
