import {
  computeRollover,
  daysMissedSince,
  MS_PER_DAY,
  yesterdailies,
  yesterdayOf,
} from '@karotto/core';
import type {
  CronStatus,
  Daily,
  Habit,
  ScoreRequest,
  Todo,
} from '@karotto/core';
import {
  and,
  eq,
  sql,
} from 'drizzle-orm';
import type { Db } from '@/db/client';
import {
  taskHistory,
  tasks,
  users,
} from '@/db/schema';
import type {
  TaskRow,
  UserRow,
} from '@/db/schema';
import { ApiError } from '@/lib/errors';
import { historyInsertValues } from '@/services/history';
import {
  deleteCompletedTodos,
  scoreTasks,
  serializeRows,
} from '@/services/tasks';
import { dayContext } from '@/services/users';

const LOCK_NOT_AVAILABLE = '55P03';

export async function cronStatus(
  db: Db,
  user: UserRow,
  now: Date,
): Promise<CronStatus> {
  const ctx = dayContext(user);
  const daysMissed = daysMissedSince(
    user.lastCron,
    now,
    ctx,
  );
  const yesterday = yesterdayOf(
    now,
    ctx,
  );
  if (daysMissed <= 0) {
    return {
      needsCron: false,
      daysMissed,
      yesterday,
      yesterdailies: [],
    };
  }
  const rows = await db.query.tasks.findMany({
    where: and(
      eq(
        tasks.userId,
        user.id,
      ),
      eq(
        tasks.type,
        'daily',
      ),
      eq(
        tasks.completed,
        false,
      ),
      eq(
        tasks.yesterdaily,
        true,
      ),
    ),
    orderBy: tasks.position,
  });
  const dailies = (await serializeRows(
    db,
    rows,
    ctx,
    now,
  )).filter((task): task is Daily => task.type === 'daily');
  return {
    needsCron: true,
    daysMissed,
    yesterday,
    yesterdailies: user.paused
      ? []
      : yesterdailies(
          dailies,
          now,
          ctx,
        ),
  };
}

function isLockNotAvailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const record = error as { code?: unknown;
    cause?: unknown; };
  return record.code === LOCK_NOT_AVAILABLE || isLockNotAvailable(record.cause);
}

async function lockUser(
  tx: Db,
  userId: string,
): Promise<UserRow> {
  let locked: UserRow[];
  try {
    locked = await tx
      .select()
      .from(users)
      .where(eq(
        users.id,
        userId,
      ))
      .for(
        'update',
        { noWait: true },
      );
  } catch (error) {
    if (isLockNotAvailable(error)) {
      throw ApiError.conflict(
        'cron_running',
        'Day rollover is already running',
      );
    }
    throw error;
  }
  const [row] = locked;
  if (!row) {
    throw ApiError.notFound('User not found');
  }
  return row;
}

export type CronRunInput = {
  scores: ScoreRequest[];
  now: Date;
};

export type CronRunResult = {
  ran: boolean;
  daysMissed: number;
  user: UserRow;
};

export async function runCron(
  db: Db,
  user: UserRow,
  input: CronRunInput,
): Promise<CronRunResult> {
  const { now } = input;
  return db.transaction(async (tx) => {
    const fresh = await lockUser(
      tx,
      user.id,
    );
    const ctx = dayContext(fresh);
    if (input.scores.length > 0) {
      await scoreTasks(
        tx,
        fresh,
        input.scores,
        now,
      );
    }
    const rows = await tx.query.tasks.findMany({
      where: and(
        eq(
          tasks.userId,
          fresh.id,
        ),
        sql`(${tasks.type} <> 'todo' or ${tasks.completed} = false)`,
      ),
    });
    const all = await serializeRows(
      tx,
      rows,
      ctx,
      now,
    );
    const result = computeRollover({
      now,
      lastCron: fresh.lastCron,
      ctx,
      paused: fresh.paused,
      habits: all.filter((task): task is Habit => task.type === 'habit'),
      dailies: all.filter((task): task is Daily => task.type === 'daily'),
      todos: all.filter((task): task is Todo => task.type === 'todo'),
    });
    if (!result) {
      return {
        ran: false,
        daysMissed: 0,
        user: fresh,
      };
    }
    await persistRollover(
      tx,
      rows,
      result,
      now,
    );
    if (fresh.completedTodoRetentionDays !== null) {
      await deleteCompletedTodos(
        tx,
        fresh.id,
        new Date(now.getTime() - fresh.completedTodoRetentionDays * MS_PER_DAY),
      );
    }
    const [updated] = await tx
      .update(users)
      .set({
        lastCron: now,
        updatedAt: now,
      })
      .where(eq(
        users.id,
        fresh.id,
      ))
      .returning();
    if (!updated) {
      throw ApiError.notFound('User not found');
    }
    return {
      ran: true,
      daysMissed: result.daysMissed,
      user: updated,
    };
  });
}

type Rollover = NonNullable<ReturnType<typeof computeRollover>>;

async function persistRollover(
  tx: Db,
  rows: TaskRow[],
  result: Rollover,
  now: Date,
): Promise<void> {
  const byId = new Map(rows.map((row) => [
    row.id,
    row,
  ]));
  for (const habit of result.habits) {
    const row = byId.get(habit.id);
    if (!row || (row.value === habit.value && row.counterUp === habit.counterUp && row.counterDown === habit.counterDown)) {
      continue;
    }
    await tx
      .update(tasks)
      .set({
        value: habit.value,
        counterUp: habit.counterUp,
        counterDown: habit.counterDown,
        updatedAt: now,
      })
      .where(eq(
        tasks.id,
        habit.id,
      ));
  }
  for (const daily of result.dailies) {
    const row = byId.get(daily.id);
    if (!row || (row.value === daily.value && row.streak === daily.streak && row.completed === daily.completed && JSON.stringify(row.checklist) === JSON.stringify(daily.checklist))) {
      continue;
    }
    await tx
      .update(tasks)
      .set({
        value: daily.value,
        streak: daily.streak,
        completed: daily.completed,
        checklist: daily.checklist,
        updatedAt: now,
      })
      .where(eq(
        tasks.id,
        daily.id,
      ));
  }
  for (const todo of result.todos) {
    const row = byId.get(todo.id);
    if (!row || row.value === todo.value) {
      continue;
    }
    await tx
      .update(tasks)
      .set({
        value: todo.value,
        updatedAt: now,
      })
      .where(eq(
        tasks.id,
        todo.id,
      ));
  }
  if (result.history.length > 0) {
    await tx.insert(taskHistory).values(result.history.map(({
      taskId,
      entry,
    }) => ({
      taskId,
      ...historyInsertValues(entry),
    })));
  }
}
