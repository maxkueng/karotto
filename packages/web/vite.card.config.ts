import {
  dirname,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    solid(),
  ],
  build: {
    outDir: resolve(
      here,
      'dist',
    ),
    emptyOutDir: false,
    target: 'es2022',
    lib: {
      entry: resolve(
        here,
        'src/card/index.tsx',
      ),
      formats: ['es'],
      fileName: () => 'karotto-card.js',
    },
  },
  resolve: {
    alias: {
      '@': resolve(
        here,
        'src',
      ),
    },
  },
});
