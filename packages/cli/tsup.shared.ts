import { readFileSync } from 'node:fs';
import type { Options } from 'tsup';

const { version } = JSON.parse(readFileSync(
  new URL(
    'package.json',
    import.meta.url,
  ),
  'utf8',
)) as { version: string };

export const shared: Options = {
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  splitting: false,
  banner: { js: '#!/usr/bin/env node' },
  define: { KAROTTO_VERSION: JSON.stringify(version) },
};
