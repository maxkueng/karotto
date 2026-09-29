import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';
import { z } from 'zod';

const storedConfigSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1),
  username: z.string().optional(),
});
export type StoredConfig = z.infer<typeof storedConfigSchema>;

export type Connection = {
  url: string;
  token: string | null;
  source: 'env' | 'file' | 'none';
};

export function configPath(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(
    homedir(),
    '.config',
  );
  return join(
    base,
    'karotto',
    'config.json',
  );
}

export function readStoredConfig(): StoredConfig | null {
  const path = configPath();
  if (!existsSync(path)) {
    return null;
  }
  const parsed = storedConfigSchema.safeParse(JSON.parse(readFileSync(
    path,
    'utf8',
  )));
  return parsed.success ? parsed.data : null;
}

export function writeStoredConfig(config: StoredConfig): string {
  const path = configPath();
  mkdirSync(
    dirname(path),
    {
      recursive: true,
      mode: 0o700,
    },
  );
  writeFileSync(
    path,
    `${JSON.stringify(
      config,
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  return path;
}

export function clearStoredConfig(): boolean {
  const path = configPath();
  if (!existsSync(path)) {
    return false;
  }
  rmSync(path);
  return true;
}

/** Environment wins over the config file so scripts can override a stored login. */
export function resolveConnection(overrideUrl?: string): Connection {
  const envUrl = process.env.KAROTTO_URL;
  const envToken = process.env.KAROTTO_TOKEN;
  if (envUrl || envToken) {
    const stored = readStoredConfig();
    return {
      url: (overrideUrl ?? envUrl ?? stored?.url ?? '').replace(
        /\/+$/,
        '',
      ),
      token: envToken ?? stored?.token ?? null,
      source: 'env',
    };
  }
  const stored = readStoredConfig();
  if (stored) {
    return {
      url: (overrideUrl ?? stored.url).replace(
        /\/+$/,
        '',
      ),
      token: stored.token,
      source: 'file',
    };
  }
  return {
    url: (overrideUrl ?? '').replace(
      /\/+$/,
      '',
    ),
    token: null,
    source: 'none',
  };
}
