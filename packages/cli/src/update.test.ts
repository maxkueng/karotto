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
  knownReleases,
  planUpdate,
  updateNotice,
} from '@/update';
import type { Release } from '@/update';

const DAY_MS = 24 * 60 * 60 * 1000;

function executableReporting(version: string): string {
  return `#!/usr/bin/env node\nexport const version = ${JSON.stringify(version)};\nconsole.log(version);\n`;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function release(
  version: string,
  requiresApi: number,
): Release {
  return {
    version,
    requiresApi,
    sha256: sha256(executableReporting(version)),
  };
}

const published = {
  releases: null as Release[] | null,
  binaries: new Map<string, string>(),
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
    const version = /^\/cli-v(\d+\.\d+\.\d+)\/karotto$/.exec(request.url ?? '')?.[1];
    if (request.url === '/cli-latest/releases.json' && published.releases !== null) {
      response.end(JSON.stringify(published.releases));
      return;
    }
    if (version) {
      response.end(published.binaries.get(version) ?? executableReporting(version));
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
  published.releases = [
    release(
      '0.4.0',
      1,
    ),
    release(
      '0.5.0',
      2,
    ),
  ];
  published.binaries.clear();
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
  'planUpdate',
  () => {
    const releases = [
      release(
        '0.4.0',
        1,
      ),
      release(
        '0.4.1',
        1,
      ),
      release(
        '0.5.0',
        2,
      ),
    ];

    it(
      'offers the newest release when the server supports it',
      () => {
        expect(planUpdate(
          releases,
          {
            version: '0.4.0',
            requiresApi: 1,
          },
          2,
        )).toMatchObject({
          action: 'install',
          release: { version: '0.5.0' },
          downgrade: false,
        });
      },
    );

    it(
      'skips releases that need a newer server',
      () => {
        expect(planUpdate(
          releases,
          {
            version: '0.4.0',
            requiresApi: 1,
          },
          1,
        )).toMatchObject({
          action: 'install',
          release: { version: '0.4.1' },
        });
      },
    );

    it(
      'stays put when nothing newer fits',
      () => {
        expect(planUpdate(
          releases,
          {
            version: '0.4.1',
            requiresApi: 1,
          },
          1,
        )).toEqual({ action: 'current' });
      },
    );

    it(
      'steps back when this build needs a newer server',
      () => {
        expect(planUpdate(
          releases,
          {
            version: '0.5.0',
            requiresApi: 2,
          },
          1,
        )).toMatchObject({
          action: 'install',
          release: { version: '0.4.1' },
          downgrade: true,
        });
      },
    );

    it(
      'reports a server older than every release',
      () => {
        expect(planUpdate(
          releases.filter((candidate) => candidate.requiresApi > 1),
          {
            version: '0.5.0',
            requiresApi: 2,
          },
          1,
        )).toEqual({ action: 'unsupported_server' });
      },
    );

    it(
      'takes the newest release when there is no server to ask',
      () => {
        expect(planUpdate(
          releases,
          {
            version: '0.4.0',
            requiresApi: 1,
          },
          null,
        )).toMatchObject({ release: { version: '0.5.0' } });
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
        executableReporting('0.4.0'),
        { mode: 0o755 },
      );
      return target;
    }

    function expectUntouched(target: string): void {
      expect(readFileSync(
        target,
        'utf8',
      )).toBe(executableReporting('0.4.0'));
      expect(readdirSync(directory)).toEqual(['karotto']);
    }

    it(
      'replaces the executable and leaves nothing staged',
      async () => {
        const target = installed();
        await installUpdate(
          release(
            '0.5.0',
            2,
          ),
          target,
          baseUrl,
        );
        expect(readFileSync(
          target,
          'utf8',
        )).toBe(executableReporting('0.5.0'));
        expect(readdirSync(directory)).toEqual(['karotto']);
      },
    );

    it(
      'keeps the old executable when the checksum does not match',
      async () => {
        const target = installed();
        await expect(installUpdate(
          {
            ...release(
              '0.5.0',
              2,
            ),
            sha256: '0'.repeat(64),
          },
          target,
          baseUrl,
        )).rejects.toMatchObject({ code: 'checksum_mismatch' });
        expectUntouched(target);
      },
    );

    it(
      'keeps the old executable when the download reports another version',
      async () => {
        const target = installed();
        const wrongBuild = executableReporting('0.6.6');
        published.binaries.set(
          '0.5.0',
          wrongBuild,
        );
        await expect(installUpdate(
          {
            ...release(
              '0.5.0',
              2,
            ),
            sha256: sha256(wrongBuild),
          },
          target,
          baseUrl,
        )).rejects.toMatchObject({ code: 'update_mismatch' });
        expectUntouched(target);
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
          release(
            '0.5.0',
            2,
          ),
          target,
          baseUrl,
        )).rejects.toMatchObject({ code: 'not_writable' });
      },
    );
  },
);

describe(
  'knownReleases',
  () => {
    it(
      'fetches at most once a day',
      async () => {
        const now = Date.now();
        await knownReleases(
          baseUrl,
          now,
        );
        await knownReleases(
          baseUrl,
          now + DAY_MS - 1,
        );
        expect(published.requests).toBe(1);
        await knownReleases(
          baseUrl,
          now + DAY_MS,
        );
        expect(published.requests).toBe(2);
      },
    );

    it(
      'keeps the last known list when a fetch fails',
      async () => {
        const now = Date.now();
        await knownReleases(
          baseUrl,
          now,
        );
        published.releases = null;
        await expect(knownReleases(
          baseUrl,
          now + DAY_MS,
        )).resolves.toHaveLength(2);
      },
    );
  },
);

describe(
  'updateNotice',
  () => {
    const releases = [
      release(
        '0.4.0',
        1,
      ),
      release(
        '0.5.0',
        2,
      ),
    ];

    it(
      'announces a newer release the server supports',
      () => {
        expect(updateNotice(
          releases,
          {
            version: '0.4.0',
            requiresApi: 1,
          },
          2,
        )).toContain('karotto 0.5.0 is available');
      },
    );

    it(
      'stays quiet about releases the server cannot serve',
      () => {
        expect(updateNotice(
          releases,
          {
            version: '0.4.0',
            requiresApi: 1,
          },
          1,
        )).toBeNull();
      },
    );

    it(
      'leaves downgrades to the server warning',
      () => {
        expect(updateNotice(
          releases,
          {
            version: '0.5.0',
            requiresApi: 2,
          },
          1,
        )).toBeNull();
      },
    );
  },
);
