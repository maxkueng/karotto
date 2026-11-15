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

export const RELEASES_URL = 'https://github.com/maxkueng/karotto/releases/download';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const NOTICE_TIMEOUT_MS = 1500;
const COMMANDS_WITHOUT_NOTICE = [
  'mcp',
  'events',
  'update',
];

const releaseSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  requiresApi: z.number().int().positive(),
});
export type Release = z.infer<typeof releaseSchema>;

const releasesSchema = z.array(releaseSchema);

const checkCacheSchema = z.object({
  checkedAt: z.number(),
  releases: releasesSchema.nullable(),
});
type CheckCache = z.infer<typeof checkCacheSchema>;

export type Build = {
  version: string;
  requiresApi: number;
};

export type Plan
  = | {
    action: 'install';
    release: Release;
    downgrade: boolean;
  }
  | { action: 'current' }
  | { action: 'unsupported_server' };

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

/** A null server revision means no server to ask, so any release fits. */
export function planUpdate(
  releases: Release[],
  current: Build,
  serverRevision: number | null,
): Plan {
  const fits = (requiresApi: number) => serverRevision === null || requiresApi <= serverRevision;
  const best = releases
    .filter((release) => fits(release.requiresApi))
    .reduce<Release | null>(
      (
        newest,
        release,
      ) => (newest === null || compareVersions(
        release.version,
        newest.version,
      ) > 0
        ? release
        : newest),
      null,
    );
  const currentFits = fits(current.requiresApi);
  if (best === null) {
    return currentFits ? { action: 'current' } : { action: 'unsupported_server' };
  }
  const order = compareVersions(
    best.version,
    current.version,
  );
  if (order > 0 || (order < 0 && !currentFits)) {
    return {
      action: 'install',
      release: best,
      downgrade: order < 0,
    };
  }
  return { action: 'current' };
}

export function availableMessage(
  latestVersion: string,
  current: string,
): string {
  return `karotto ${latestVersion} is available (you have ${current}). Run \`karotto update\`.`;
}

export async function fetchReleases(
  baseUrl = RELEASES_URL,
  timeoutMs = 10_000,
): Promise<Release[]> {
  const response = await download(
    `${baseUrl}/cli-latest/releases.json`,
    timeoutMs,
  );
  const parsed = releasesSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new CliError(
      'update_check_failed',
      'The published releases.json is malformed',
    );
  }
  return parsed.data;
}

export function installPath(): string {
  return realpathSync(process.argv[1] ?? '');
}

/** Stages the new file next to the target so the final rename is atomic. */
export async function installUpdate(
  release: Release,
  target: string,
  baseUrl = RELEASES_URL,
): Promise<void> {
  const directory = dirname(target);
  assertWritable(directory);
  const response = await download(
    `${baseUrl}/cli-v${release.version}/karotto`,
    60_000,
  );
  const body = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(body).digest('hex') !== release.sha256) {
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
    if (reported !== release.version) {
      throw new CliError(
        'update_mismatch',
        `The download reports version ${reported}, expected ${release.version}; nothing was changed`,
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

/** Fetches at most once per interval; a failed fetch keeps the last known list. */
export async function knownReleases(
  baseUrl = RELEASES_URL,
  now = Date.now(),
): Promise<Release[] | null> {
  const cached = readCheckCache();
  if (cached && now - cached.checkedAt < CHECK_INTERVAL_MS) {
    return cached.releases;
  }
  const fetched = await fetchReleases(
    baseUrl,
    NOTICE_TIMEOUT_MS,
  ).catch(() => null);
  const releases = fetched ?? cached?.releases ?? null;
  writeCheckCache({
    checkedAt: now,
    releases,
  });
  return releases;
}

export function updateNotice(
  releases: Release[],
  current: Build,
  serverRevision: number,
): string | null {
  const plan = planUpdate(
    releases,
    current,
    serverRevision,
  );
  return plan.action === 'install' && !plan.downgrade
    ? availableMessage(
        plan.release.version,
        current.version,
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
