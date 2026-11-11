import { defineConfig } from 'tsup';
import { shared } from './tsup.shared';

export default defineConfig({
  ...shared,
  entry: { karotto: 'src/main.ts' },
  outDir: 'dist/standalone',
  noExternal: [/.*/],
});
