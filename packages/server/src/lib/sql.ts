import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type {
  PgColumn,
  PgTable,
} from 'drizzle-orm/pg-core';
import type { Db } from '@/db/client';

export function uuidArray(ids: readonly string[]): SQL {
  if (ids.length === 0) {
    return sql`array[]::uuid[]`;
  }
  return sql`array[${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[]`;
}

type PositionedTable = PgTable & {
  id: PgColumn;
  userId: PgColumn;
  position: PgColumn;
};

export async function writePositions(
  db: Db,
  table: PositionedTable,
  userId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await db.execute(sql`
    update ${table} set position = ordered.position - 1
    from unnest(${uuidArray(ids)}) with ordinality as ordered(id, position)
    where ${table.id} = ordered.id and ${table.userId} = ${userId}
  `);
}
