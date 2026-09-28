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
  root: resolve(
    here,
    'src',
  ),
  plugins: [
    tailwindcss(),
    solid(),
  ],
  build: {
    outDir: resolve(
      here,
      'dist',
    ),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(
        here,
        'src',
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': 'http://localhost:3210',
    },
  },
});
