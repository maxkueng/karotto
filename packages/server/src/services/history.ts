import type {
  HistoryEntry,
  HistoryOp,
} from '@karotto/core';
import {
  and,
  asc,
  desc,
  eq,
} from 'drizzle-orm';
import type { Db } from '@/db/client';
import { taskHistory } from '@/db/schema';
import type { TaskHistoryRow } from '@/db/schema';

export async function lastHistoryEntry(
  db: Db,
  taskId: string,
): Promise<TaskHistoryRow | null> {
  const row = await db.query.taskHistory.findFirst({
    where: eq(
      taskHistory.taskId,
      taskId,
    ),
    orderBy: [
      desc(taskHistory.date),
      desc(taskHistory.id),
    ],
  });
  return row ?? null;
}

export async function listHistory(
  db: Db,
  taskId: string,
): Promise<TaskHistoryRow[]> {
  return db.query.taskHistory.findMany({
    where: eq(
      taskHistory.taskId,
      taskId,
    ),
    orderBy: [
      asc(taskHistory.date),
      asc(taskHistory.id),
    ],
  });
}

export function historyInsertValues(entry: HistoryEntry) {
  return {
    date: new Date(entry.date),
    value: entry.value,
    scoredUp: entry.scoredUp,
    scoredDown: entry.scoredDown,
    isDue: entry.isDue,
    completed: entry.completed,
  };
}

export async function applyHistoryOp(
  db: Db,
  taskId: string,
  op: HistoryOp,
  cdsDayOf: (date: Date) => string,
): Promise<void> {
  switch (op.op) {
    case 'append':
      await db.insert(taskHistory).values({
        taskId,
        ...historyInsertValues(op.entry),
      });
      return;
    case 'replaceLast': {
      const last = await lastHistoryEntry(
        db,
        taskId,
      );
      if (!last) {
        await db.insert(taskHistory).values({
          taskId,
          ...historyInsertValues(op.entry),
        });
        return;
      }
      await db
        .update(taskHistory)
        .set(historyInsertValues(op.entry))
        .where(eq(
          taskHistory.id,
          last.id,
        ));
      return;
    }
    case 'removeCheck': {
      const last = await db.query.taskHistory.findFirst({
        where: and(
          eq(
            taskHistory.taskId,
            taskId,
          ),
          eq(
            taskHistory.completed,
            true,
          ),
        ),
        orderBy: [
          desc(taskHistory.date),
          desc(taskHistory.id),
        ],
      });
      if (last && cdsDayOf(last.date) === op.day) {
        await db.delete(taskHistory).where(eq(
          taskHistory.id,
          last.id,
        ));
      }
    }
  }
}
