import { defineConfig } from 'tsup';
import { shared } from './tsup.shared';

export default defineConfig({
  ...shared,
  entry: ['src/main.ts'],
  sourcemap: true,
  noExternal: ['@karotto/core'],
});
