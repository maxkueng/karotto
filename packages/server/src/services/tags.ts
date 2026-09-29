import type { Tag } from '@karotto/core';
import {
  and,
  asc,
  eq,
  inArray,
  sql,
} from 'drizzle-orm';
import type { Db } from '@/db/client';
import { tags } from '@/db/schema';
import type { TagRow } from '@/db/schema';
import {
  ApiError,
  isUniqueViolation,
} from '@/lib/errors';
import { mergeOrder } from '@/lib/order';
import { writePositions } from '@/lib/sql';

export function serializeTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTags(
  db: Db,
  userId: string,
): Promise<TagRow[]> {
  return db.query.tags.findMany({
    where: eq(
      tags.userId,
      userId,
    ),
    orderBy: [
      asc(tags.position),
      asc(tags.createdAt),
    ],
  });
}

export async function assertTagsExist(
  db: Db,
  userId: string,
  ids: string[],
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return;
  }
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(
      eq(
        tags.userId,
        userId,
      ),
      inArray(
        tags.id,
        unique,
      ),
    ));
  if (rows.length !== unique.length) {
    const known = new Set(rows.map((row) => row.id));
    const missing = unique.filter((id) => !known.has(id));
    throw ApiError.badRequest(
      'Unknown tag',
      { tags: missing },
    );
  }
}

function tagConflictOr(error: unknown): unknown {
  return isUniqueViolation(
    error,
    'tags_user_name_idx',
  )
    ? ApiError.conflict(
        'tag_exists',
        'A tag with that name already exists',
      )
    : error;
}

export async function createTag(
  db: Db,
  userId: string,
  name: string,
  now: Date,
): Promise<TagRow> {
  try {
    const [row] = await db
      .insert(tags)
      .values({
        userId,
        name,
        position: sql`(select coalesce(max(${tags.position}), -1) + 1 from ${tags} where ${tags.userId} = ${userId})`,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error('Insert returned no row');
    }
    return row;
  } catch (error) {
    throw tagConflictOr(error);
  }
}

export async function updateTag(
  db: Db,
  userId: string,
  id: string,
  name: string,
  now: Date,
): Promise<TagRow> {
  let updated: TagRow[];
  try {
    updated = await db
      .update(tags)
      .set({
        name,
        updatedAt: now,
      })
      .where(and(
        eq(
          tags.userId,
          userId,
        ),
        eq(
          tags.id,
          id,
        ),
      ))
      .returning();
  } catch (error) {
    throw tagConflictOr(error);
  }
  const [row] = updated;
  if (!row) {
    throw ApiError.notFound('Tag not found');
  }
  return row;
}

export async function deleteTag(
  db: Db,
  userId: string,
  id: string,
): Promise<void> {
  const deleted = await db
    .delete(tags)
    .where(and(
      eq(
        tags.userId,
        userId,
      ),
      eq(
        tags.id,
        id,
      ),
    ))
    .returning({ id: tags.id });
  if (deleted.length === 0) {
    throw ApiError.notFound('Tag not found');
  }
}

export async function reorderTags(
  db: Db,
  userId: string,
  ids: string[],
): Promise<TagRow[]> {
  const current = (await listTags(
    db,
    userId,
  )).map((row) => row.id);
  await writePositions(
    db,
    tags,
    userId,
    mergeOrder(
      ids,
      current,
    ),
  );
  return listTags(
    db,
    userId,
  );
}
