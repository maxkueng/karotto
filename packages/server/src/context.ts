import type { Config } from '@/config';
import type { Db } from '@/db/client';
import type { Clock } from '@/lib/clock';

export type AppContext = {
  db: Db;
  clock: Clock;
  config: Config;
};
