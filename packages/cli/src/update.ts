import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import {
  basename,
  dirname,
  join,
} from 'node:path';
import { z } from 'zod';
import { CliError } from '@/client';
import { standalone } from '@/version';

export const RELEASE_URL = 'https://github.com/maxkueng/karotto/releases/download/cli-latest';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const NOTICE_TIMEOUT_MS = 1500;
const COMMANDS_WITHOUT_NOTICE = [
  'mcp',
  'events',
  'update',
];

const latestSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type Latest = z.infer<typeof latestSchema>;

const checkCacheSchema = z.object({
  checkedAt: z.number(),
  latestVersion: z.string().nullable(),
});
type CheckCache = z.infer<typeof checkCacheSchema>;

export function compareVersions(
  a: string,
  b: string,
): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }
  return 0;
}

export function availableMessage(
  latestVersion: string,
  current: string,
): string {
  return `karotto ${latestVersion} is available (you have ${current}). Run \`karotto update\`.`;
}

export async function fetchLatest(
  baseUrl = RELEASE_URL,
  timeoutMs = 10_000,
): Promise<Latest> {
  const response = await download(
    `${baseUrl}/latest.json`,
    timeoutMs,
  );
  const parsed = latestSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new CliError(
      'update_check_failed',
      'The published latest.json is malformed',
    );
  }
  return parsed.data;
}

export function installPath(): string {
  return realpathSync(process.argv[1] ?? '');
}

/** Stages the new file next to the target so the final rename is atomic. */
export async function installUpdate(
  latest: Latest,
  target: string,
  baseUrl = RELEASE_URL,
): Promise<void> {
  const directory = dirname(target);
  assertWritable(directory);
  const response = await download(
    `${baseUrl}/karotto`,
    60_000,
  );
  const body = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(body).digest('hex') !== latest.sha256) {
    throw new CliError(
      'checksum_mismatch',
      'The download does not match the published checksum; nothing was changed',
    );
  }
  const staged = join(
    directory,
    `.${basename(target)}-update-${process.pid}`,
  );
  try {
    writeFileSync(
      staged,
      body,
      { mode: 0o755 },
    );
    const reported = execFileSync(
      process.execPath,
      [
        staged,
        '--version',
      ],
      { encoding: 'utf8' },
    ).trim();
    if (reported !== latest.version) {
      throw new CliError(
        'update_mismatch',
        `The download reports version ${reported}, expected ${latest.version}; nothing was changed`,
      );
    }
    renameSync(
      staged,
      target,
    );
  } finally {
    rmSync(
      staged,
      { force: true },
    );
  }
}

export function wantsUpdateNotice(args: string[]): boolean {
  const [command] = args;
  return standalone
    && !process.env.KAROTTO_NO_UPDATE_CHECK
    && process.stderr.isTTY
    && !args.includes('--json')
    && command !== undefined
    && !command.startsWith('-')
    && !COMMANDS_WITHOUT_NOTICE.includes(command);
}

/** Checks at most once per interval; a failed check keeps the last known version. */
export async function updateNotice(
  current: string,
  baseUrl = RELEASE_URL,
  now = Date.now(),
): Promise<string | null> {
  const cached = readCheckCache();
  let latestVersion = cached?.latestVersion ?? null;
  if (!cached || now - cached.checkedAt >= CHECK_INTERVAL_MS) {
    const latest = await fetchLatest(
      baseUrl,
      NOTICE_TIMEOUT_MS,
    ).catch(() => null);
    latestVersion = latest?.version ?? latestVersion;
    writeCheckCache({
      checkedAt: now,
      latestVersion,
    });
  }
  return latestVersion && compareVersions(
    latestVersion,
    current,
  ) > 0
    ? availableMessage(
        latestVersion,
        current,
      )
    : null;
}

export function writeCheckCache(cache: CheckCache): void {
  const path = checkCachePath();
  mkdirSync(
    dirname(path),
    { recursive: true },
  );
  writeFileSync(
    path,
    `${JSON.stringify(cache)}\n`,
  );
}

function readCheckCache(): CheckCache | null {
  try {
    const parsed = checkCacheSchema.safeParse(JSON.parse(readFileSync(
      checkCachePath(),
      'utf8',
    )));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function checkCachePath(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(
    homedir(),
    '.cache',
  );
  return join(
    base,
    'karotto',
    'update-check.json',
  );
}

function assertWritable(directory: string): void {
  try {
    accessSync(
      directory,
      constants.W_OK,
    );
  } catch {
    throw new CliError(
      'not_writable',
      `Cannot write to ${directory}. A system-wide install updates with sudo; a copy in ~/.local/bin updates itself.`,
    );
  }
}

async function download(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const response = await fetch(
    url,
    { signal: AbortSignal.timeout(timeoutMs) },
  ).catch((error: unknown) => {
    throw new CliError(
      'update_check_failed',
      `Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  if (!response.ok) {
    throw new CliError(
      'update_check_failed',
      `${url} answered HTTP ${response.status}`,
    );
  }
  return response;
}
