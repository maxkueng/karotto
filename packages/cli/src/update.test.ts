import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  compareVersions,
  installUpdate,
  updateNotice,
} from '@/update';
import type { Latest } from '@/update';

const DAY_MS = 24 * 60 * 60 * 1000;

function executableReporting(version: string): string {
  return `#!/usr/bin/env node\nexport const version = ${JSON.stringify(version)};\nconsole.log(version);\n`;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

const published = {
  binary: executableReporting('9.9.9'),
  latest: null as string | null,
  requests: 0,
};

let server: Server;
let baseUrl: string;
let directory: string;

beforeAll(async () => {
  server = createServer((
    request,
    response,
  ) => {
    published.requests += 1;
    if (request.url === '/latest.json' && published.latest !== null) {
      response.end(published.latest);
      return;
    }
    if (request.url === '/karotto') {
      response.end(published.binary);
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(
    0,
    '127.0.0.1',
    resolve,
  ));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  directory = mkdtempSync(join(
    tmpdir(),
    'karotto-update-',
  ));
  process.env.XDG_CACHE_HOME = join(
    directory,
    'cache',
  );
  published.binary = executableReporting('9.9.9');
  published.latest = JSON.stringify({
    version: '9.9.9',
    sha256: sha256(published.binary),
  });
  published.requests = 0;
});

afterEach(() => {
  chmodSync(
    directory,
    0o700,
  );
  rmSync(
    directory,
    {
      recursive: true,
      force: true,
    },
  );
  delete process.env.XDG_CACHE_HOME;
});

describe(
  'compareVersions',
  () => {
    it(
      'compares numerically per component',
      () => {
        expect(compareVersions(
          '0.10.0',
          '0.9.9',
        )).toBe(1);
        expect(compareVersions(
          '0.3.4',
          '0.3.4',
        )).toBe(0);
        expect(compareVersions(
          '0.3.4',
          '1.0.0',
        )).toBe(-1);
      },
    );
  },
);

describe(
  'installUpdate',
  () => {
    function installed(): string {
      const target = join(
        directory,
        'karotto',
      );
      writeFileSync(
        target,
        executableReporting('0.3.4'),
        { mode: 0o755 },
      );
      return target;
    }

    function latest(overrides: Partial<Latest> = {}): Latest {
      return {
        version: '9.9.9',
        sha256: sha256(published.binary),
        ...overrides,
      };
    }

    it(
      'replaces the executable and leaves nothing staged',
      async () => {
        const target = installed();
        await installUpdate(
          latest(),
          target,
          baseUrl,
        );
        expect(readFileSync(
          target,
          'utf8',
        )).toBe(published.binary);
        expect(readdirSync(directory)).toEqual(['karotto']);
      },
    );

    it(
      'keeps the old executable when the checksum does not match',
      async () => {
        const target = installed();
        await expect(installUpdate(
          latest({ sha256: '0'.repeat(64) }),
          target,
          baseUrl,
        )).rejects.toMatchObject({ code: 'checksum_mismatch' });
        expect(readFileSync(
          target,
          'utf8',
        )).toBe(executableReporting('0.3.4'));
      },
    );

    it(
      'keeps the old executable when the download reports another version',
      async () => {
        const target = installed();
        await expect(installUpdate(
          latest({ version: '9.9.10' }),
          target,
          baseUrl,
        )).rejects.toMatchObject({ code: 'update_mismatch' });
        expect(readFileSync(
          target,
          'utf8',
        )).toBe(executableReporting('0.3.4'));
        expect(readdirSync(directory)).toEqual(['karotto']);
      },
    );

    it.skipIf(process.getuid?.() === 0)(
      'refuses a directory it cannot write to',
      async () => {
        const target = installed();
        chmodSync(
          directory,
          0o500,
        );
        await expect(installUpdate(
          latest(),
          target,
          baseUrl,
        )).rejects.toMatchObject({ code: 'not_writable' });
      },
    );
  },
);

describe(
  'updateNotice',
  () => {
    it(
      'announces a newer release',
      async () => {
        await expect(updateNotice(
          '0.3.4',
          baseUrl,
        )).resolves.toContain('karotto 9.9.9 is available');
      },
    );

    it(
      'stays quiet when up to date',
      async () => {
        await expect(updateNotice(
          '9.9.9',
          baseUrl,
        )).resolves.toBeNull();
      },
    );

    it(
      'checks at most once a day',
      async () => {
        const now = Date.now();
        await updateNotice(
          '0.3.4',
          baseUrl,
          now,
        );
        await updateNotice(
          '0.3.4',
          baseUrl,
          now + DAY_MS - 1,
        );
        expect(published.requests).toBe(1);
        await updateNotice(
          '0.3.4',
          baseUrl,
          now + DAY_MS,
        );
        expect(published.requests).toBe(2);
      },
    );

    it(
      'keeps the last known release when a check fails',
      async () => {
        const now = Date.now();
        await updateNotice(
          '0.3.4',
          baseUrl,
          now,
        );
        published.latest = null;
        await expect(updateNotice(
          '0.3.4',
          baseUrl,
          now + DAY_MS,
        )).resolves.toContain('karotto 9.9.9 is available');
      },
    );
  },
);
