import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'cli',
    include: ['src/**/*.test.ts'],
  },
});
