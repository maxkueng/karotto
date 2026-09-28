import { buildApp } from '@/app';
import {
  loadConfig,
  loadDotEnv,
} from '@/config';
import { createDb } from '@/db/client';
import { systemClock } from '@/lib/clock';
import { EventHub } from '@/services/events';

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadConfig();
  const handle = createDb(
    config.DATABASE_URL,
    config.MIGRATIONS_DIR,
  );
  if (config.AUTO_MIGRATE) {
    await handle.migrate();
  }
  const app = await buildApp({
    db: handle.db,
    clock: systemClock,
    config,
    events: new EventHub(),
  });

  const shutdown = async () => {
    await app.close();
    await handle.close();
    process.exit(0);
  };
  process.on(
    'SIGINT',
    () => void shutdown(),
  );
  process.on(
    'SIGTERM',
    () => void shutdown(),
  );

  await app.listen({
    host: config.HOST,
    port: config.PORT,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
