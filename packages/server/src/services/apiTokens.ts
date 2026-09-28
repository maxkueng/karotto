import type {
  ApiToken,
  ApiTokenCreated,
} from '@karotto/core';
import {
  and,
  desc,
  eq,
} from 'drizzle-orm';
import {
  generateApiToken,
  hashToken,
} from '@/auth/tokens';
import type { Db } from '@/db/client';
import {
  apiTokens,
  users,
} from '@/db/schema';
import type {
  ApiTokenRow,
  UserRow,
} from '@/db/schema';
import { ApiError } from '@/lib/errors';

const LAST_USED_INTERVAL_MS = 60 * 1000;

export function serializeApiToken(row: ApiTokenRow): ApiToken {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

export async function listApiTokens(
  db: Db,
  userId: string,
): Promise<ApiToken[]> {
  const rows = await db.query.apiTokens.findMany({
    where: eq(
      apiTokens.userId,
      userId,
    ),
    orderBy: desc(apiTokens.createdAt),
  });
  return rows.map(serializeApiToken);
}

export type ApiTokenCreateInput = {
  userId: string;
  name: string;
  expiresAt: Date | null;
  now: Date;
};

export async function createApiToken(
  db: Db,
  input: ApiTokenCreateInput,
): Promise<ApiTokenCreated> {
  const generated = generateApiToken();
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId: input.userId,
      name: input.name,
      tokenHash: generated.hash,
      prefix: generated.prefix,
      createdAt: input.now,
      expiresAt: input.expiresAt,
    })
    .returning();
  if (!row) {
    throw new Error('Insert returned no row');
  }
  return {
    ...serializeApiToken(row),
    token: generated.token,
  };
}

export async function revokeApiToken(
  db: Db,
  userId: string,
  id: string,
): Promise<void> {
  const deleted = await db
    .delete(apiTokens)
    .where(and(
      eq(
        apiTokens.userId,
        userId,
      ),
      eq(
        apiTokens.id,
        id,
      ),
    ))
    .returning({ id: apiTokens.id });
  if (deleted.length === 0) {
    throw ApiError.notFound('Token not found');
  }
}

export async function resolveApiToken(
  db: Db,
  token: string,
  now: Date,
): Promise<UserRow | null> {
  const [row] = await db
    .select({
      token: apiTokens,
      user: users,
    })
    .from(apiTokens)
    .innerJoin(
      users,
      eq(
        users.id,
        apiTokens.userId,
      ),
    )
    .where(eq(
      apiTokens.tokenHash,
      hashToken(token),
    ))
    .limit(1);
  if (!row) {
    return null;
  }
  if (row.token.expiresAt && row.token.expiresAt.getTime() <= now.getTime()) {
    return null;
  }
  const lastUsed = row.token.lastUsedAt?.getTime() ?? 0;
  if (now.getTime() - lastUsed > LAST_USED_INTERVAL_MS) {
    await db
      .update(apiTokens)
      .set({ lastUsedAt: now })
      .where(eq(
        apiTokens.id,
        row.token.id,
      ));
  }
  return row.user;
}
