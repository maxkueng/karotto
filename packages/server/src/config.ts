import { existsSync } from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';
import { z } from 'zod';

const booleanString = z
  .enum([
    'true',
    'false',
    '1',
    '0',
  ])
  .transform((value) => value === 'true' || value === '1');

const configSchema = z.object({
  NODE_ENV: z.enum([
    'development',
    'production',
    'test',
  ]).default('development'),
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum([
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ]).default('info'),
  STATIC_DIR: z.string().optional(),
  MIGRATIONS_DIR: z.string().optional(),
  AUTO_MIGRATE: booleanString.default(true),
  SECURE_COOKIES: booleanString.optional(),
  TRUST_PROXY: booleanString.default(false),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
});

export type Config = z.infer<typeof configSchema> & { secureCookies: boolean };

export function loadDotEnv(start = process.cwd()): string | null {
  let dir = start;
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = resolve(
      dir,
      '.env',
    );
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid configuration:\n${issues.join('\n')}`);
  }
  const config = parsed.data;
  return {
    ...config,
    secureCookies: config.SECURE_COOKIES ?? config.NODE_ENV === 'production',
  };
}
