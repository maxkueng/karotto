import {
  daysMissedSince,
} from '@karotto/core';
import type {
  DateFormat,
  DayContext,
  Preferences,
  PreferencesUpdate,
  User,
} from '@karotto/core';
import {
  eq,
  sql,
} from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
} from '@/auth/password';
import type { Db } from '@/db/client';
import { users } from '@/db/schema';
import type { UserRow } from '@/db/schema';
import {
  ApiError,
  isUniqueViolation,
} from '@/lib/errors';

export function dayContext(user: UserRow): DayContext {
  return {
    timezone: user.timezone,
    dayStart: user.dayStart,
  };
}

export function preferencesOf(user: UserRow): Preferences {
  return {
    dayStart: user.dayStart,
    timezone: user.timezone,
    dateFormat: user.dateFormat as DateFormat,
    completedTodoRetentionDays: user.completedTodoRetentionDays,
  };
}

export function needsCron(
  user: UserRow,
  now: Date,
): boolean {
  return daysMissedSince(
    user.lastCron,
    now,
    dayContext(user),
  ) > 0;
}

export function serializeUser(
  user: UserRow,
  now: Date,
): User {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    lastCron: user.lastCron.toISOString(),
    needsCron: needsCron(
      user,
      now,
    ),
    preferences: preferencesOf(user),
  };
}

export async function findUserByUsername(
  db: Db,
  username: string,
): Promise<UserRow | null> {
  const row = await db.query.users.findFirst({ where: sql`lower(${users.username}) = lower(${username})` });
  return row ?? null;
}

export async function listUsers(db: Db): Promise<UserRow[]> {
  return db.query.users.findMany({ orderBy: users.username });
}

export type CreateUserInput = {
  username: string;
  password: string;
  timezone?: string;
};

export async function createUser(
  db: Db,
  input: CreateUserInput,
): Promise<UserRow> {
  const passwordHash = await hashPassword(input.password);
  try {
    const [row] = await db
      .insert(users)
      .values({
        username: input.username,
        passwordHash,
        timezone: input.timezone ?? 'UTC',
      })
      .returning();
    if (!row) {
      throw new Error('Insert returned no row');
    }
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw ApiError.conflict(
        'username_taken',
        'Username is already taken',
      );
    }
    throw error;
  }
}

export async function authenticate(
  db: Db,
  username: string,
  password: string,
): Promise<UserRow | null> {
  const user = await findUserByUsername(
    db,
    username,
  );
  if (!user) {
    await verifyPassword(
      '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      password,
    );
    return null;
  }
  const ok = await verifyPassword(
    user.passwordHash,
    password,
  );
  return ok ? user : null;
}

export async function setPassword(
  db: Db,
  userId: string,
  password: string,
): Promise<void> {
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      updatedAt: new Date(),
    })
    .where(eq(
      users.id,
      userId,
    ));
}

export async function deleteUser(
  db: Db,
  userId: string,
): Promise<void> {
  await db.delete(users).where(eq(
    users.id,
    userId,
  ));
}

export async function updatePreferences(
  db: Db,
  user: UserRow,
  patch: PreferencesUpdate,
  now: Date,
): Promise<UserRow> {
  const values: Partial<typeof users.$inferInsert> = { updatedAt: now };
  if (patch.timezone !== undefined) {
    values.timezone = patch.timezone;
  }
  if (patch.dateFormat !== undefined) {
    values.dateFormat = patch.dateFormat;
  }
  if (patch.completedTodoRetentionDays !== undefined) {
    values.completedTodoRetentionDays = patch.completedTodoRetentionDays;
  }
  if (patch.dayStart !== undefined && patch.dayStart !== user.dayStart) {
    values.dayStart = patch.dayStart;
    values.lastCron = now;
  }
  const [row] = await db
    .update(users)
    .set(values)
    .where(eq(
      users.id,
      user.id,
    ))
    .returning();
  if (!row) {
    throw ApiError.notFound('User not found');
  }
  return row;
}
