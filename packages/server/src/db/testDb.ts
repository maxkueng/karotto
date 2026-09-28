import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { defaultMigrationsDir } from '@/db/client';
import type { DbHandle } from '@/db/client';
import * as schema from '@/db/schema';

export async function createTestDb(): Promise<DbHandle> {
  const client = new PGlite();
  const db = drizzle(
    client,
    { schema },
  );
  const handle: DbHandle = {
    db,
    migrate: () => migrate(
      db,
      { migrationsFolder: defaultMigrationsDir() },
    ),
    close: () => client.close(),
  };
  await handle.migrate();
  return handle;
}
