import { existsSync } from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '@/db/schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type DbHandle = {
  db: Db;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
};

const here = dirname(fileURLToPath(import.meta.url));

export function defaultMigrationsDir(): string {
  let dir = here;
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = resolve(
      dir,
      'drizzle',
    );
    if (existsSync(resolve(
      candidate,
      'meta/_journal.json',
    ))) {
      return candidate;
    }
    dir = dirname(dir);
  }
  throw new Error('Could not locate the drizzle migrations directory; set MIGRATIONS_DIR');
}

export function createDb(
  url: string,
  migrationsFolder = defaultMigrationsDir(),
): DbHandle {
  const client = postgres(
    url,
    {
      max: 10,
      onnotice: () => undefined,
    },
  );
  const db = drizzlePostgres(
    client,
    { schema },
  );
  return {
    db,
    migrate: () => migratePostgres(
      db,
      { migrationsFolder },
    ),
    close: () => client.end(),
  };
}
