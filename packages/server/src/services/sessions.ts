import { MS_PER_DAY } from '@karotto/core';
import {
  and,
  eq,
  gt,
} from 'drizzle-orm';
import {
  generateSessionToken,
  hashToken,
} from '@/auth/tokens';
import type { Db } from '@/db/client';
import {
  sessions,
  users,
} from '@/db/schema';
import type { UserRow } from '@/db/schema';

const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type SessionCreateInput = {
  userId: string;
  userAgent: string | null;
  ttlDays: number;
  now: Date;
};

export async function createSession(
  db: Db,
  input: SessionCreateInput,
): Promise<string> {
  const token = generateSessionToken();
  await db.insert(sessions).values({
    userId: input.userId,
    tokenHash: hashToken(token),
    userAgent: input.userAgent,
    createdAt: input.now,
    lastSeenAt: input.now,
    expiresAt: new Date(input.now.getTime() + input.ttlDays * MS_PER_DAY),
  });
  return token;
}

export async function resolveSession(
  db: Db,
  token: string,
  ttlDays: number,
  now: Date,
): Promise<UserRow | null> {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(
      users,
      eq(
        users.id,
        sessions.userId,
      ),
    )
    .where(and(
      eq(
        sessions.tokenHash,
        tokenHash,
      ),
      gt(
        sessions.expiresAt,
        now,
      ),
    ))
    .limit(1);
  if (!row) {
    return null;
  }
  if (now.getTime() - row.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + ttlDays * MS_PER_DAY),
      })
      .where(eq(
        sessions.id,
        row.session.id,
      ));
  }
  return row.user;
}

export async function deleteSession(
  db: Db,
  token: string,
): Promise<void> {
  await db.delete(sessions).where(eq(
    sessions.tokenHash,
    hashToken(token),
  ));
}
