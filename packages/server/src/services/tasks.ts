import { randomUUID } from 'node:crypto';
import {
  cdsDay,
  isUuid,
  scoreDaily,
  scoreHabit,
  scoreTodo,
  validateDailyRules,
} from '@karotto/core';
import type {
  ChecklistItem,
  ChecklistItemInput,
  ChecklistItemPatch,
  DayContext,
  Reminder,
  ReminderInput,
  ScoreDirection,
  ScoreRequest,
  ScoreResult,
  Task,
  TaskCreate,
  TaskType,
  TaskUpdateFor,
} from '@karotto/core';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lt,
  ne,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Db } from '@/db/client';
import {
  taskTags,
  tasks,
} from '@/db/schema';
import type {
  TaskInsert,
  TaskRow,
  UserRow,
} from '@/db/schema';
import {
  ApiError,
  isUniqueViolation,
} from '@/lib/errors';
import {
  mergeOrder,
  moveWithin,
} from '@/lib/order';
import { writePositions } from '@/lib/sql';
import {
  applyHistoryOp,
  lastHistoryEntry,
} from '@/services/history';
import {
  serializeHistory,
  serializeTask,
} from '@/services/serialize';
import { assertTagsExist } from '@/services/tags';
import { dayContext } from '@/services/users';

export type TaskListFilter = 'habits' | 'dailies' | 'todos' | 'completedTodos' | undefined;

function taskCondition(
  userId: string,
  filter: TaskListFilter,
) {
  const own = eq(
    tasks.userId,
    userId,
  );
  switch (filter) {
    case 'habits':
      return and(
        own,
        eq(
          tasks.type,
          'habit',
        ),
      );
    case 'dailies':
      return and(
        own,
        eq(
          tasks.type,
          'daily',
        ),
      );
    case 'todos':
      return and(
        own,
        eq(
          tasks.type,
          'todo',
        ),
        eq(
          tasks.completed,
          false,
        ),
      );
    case 'completedTodos':
      return and(
        own,
        eq(
          tasks.type,
          'todo',
        ),
        eq(
          tasks.completed,
          true,
        ),
      );
    default:
      return and(
        own,
        sql`(${tasks.type} <> 'todo' or ${tasks.completed} = false)`,
      );
  }
}

async function tagIdsByTask(
  db: Db,
  taskIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (taskIds.length === 0) {
    return map;
  }
  const rows = await db
    .select({
      taskId: taskTags.taskId,
      tagId: taskTags.tagId,
    })
    .from(taskTags)
    .where(inArray(
      taskTags.taskId,
      taskIds,
    ));
  rows.forEach((row) => {
    const list = map.get(row.taskId) ?? [];
    list.push(row.tagId);
    map.set(
      row.taskId,
      list,
    );
  });
  return map;
}

export async function serializeRows(
  db: Db,
  rows: TaskRow[],
  ctx: DayContext,
  now: Date,
): Promise<Task[]> {
  const tagMap = await tagIdsByTask(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => serializeTask(
    row,
    tagMap.get(row.id) ?? [],
    ctx,
    now,
  ));
}

export async function serializeRow(
  db: Db,
  row: TaskRow,
  ctx: DayContext,
  now: Date,
): Promise<Task> {
  const tagMap = await tagIdsByTask(
    db,
    [row.id],
  );
  return serializeTask(
    row,
    tagMap.get(row.id) ?? [],
    ctx,
    now,
  );
}

export async function listTasks(
  db: Db,
  user: UserRow,
  filter: TaskListFilter,
  now: Date,
): Promise<Task[]> {
  const rows = await db.query.tasks.findMany({
    where: taskCondition(
      user.id,
      filter,
    ),
    orderBy: filter === 'completedTodos'
      ? [desc(tasks.dateCompleted)]
      : [
          asc(tasks.type),
          asc(tasks.position),
          desc(tasks.createdAt),
        ],
  });
  return serializeRows(
    db,
    rows,
    dayContext(user),
    now,
  );
}

export async function findTaskRow(
  db: Db,
  userId: string,
  identifier: string,
): Promise<TaskRow | null> {
  const byId = isUuid(identifier);
  const row = await db.query.tasks.findFirst({
    where: and(
      eq(
        tasks.userId,
        userId,
      ),
      byId
        ? eq(
            tasks.id,
            identifier,
          )
        : eq(
            tasks.alias,
            identifier,
          ),
    ),
  });
  return row ?? null;
}

export async function requireTaskRow(
  db: Db,
  userId: string,
  identifier: string,
): Promise<TaskRow> {
  const row = await findTaskRow(
    db,
    userId,
    identifier,
  );
  if (!row) {
    throw ApiError.notFound('Task not found');
  }
  return row;
}

function normalizeChecklist(items: ChecklistItemInput[]): ChecklistItem[] {
  return items
    .filter((item) => item.text.trim() !== '')
    .map((item) => ({
      id: item.id ?? randomUUID(),
      text: item.text,
      completed: item.completed,
    }));
}

function normalizeReminders(items: ReminderInput[]): Reminder[] {
  return items.map((item) => ({
    id: item.id ?? randomUUID(),
    time: new Date(item.time).toISOString(),
    startDate: item.startDate,
  }));
}

function insertValues(
  userId: string,
  input: TaskCreate,
  ctx: DayContext,
  now: Date,
): TaskInsert {
  const common: TaskInsert = {
    userId,
    type: input.type,
    text: input.text,
    notes: input.notes,
    alias: input.alias,
    reminders: normalizeReminders(input.reminders),
    createdAt: now,
    updatedAt: now,
  };
  switch (input.type) {
    case 'habit':
      return {
        ...common,
        up: input.up,
        down: input.down,
        counterUp: input.counterUp,
        counterDown: input.counterDown,
        frequency: input.frequency,
      };
    case 'daily':
      return {
        ...common,
        collapseChecklist: input.collapseChecklist,
        checklist: normalizeChecklist(input.checklist),
        frequency: input.frequency,
        everyX: input.everyX,
        startDate: input.startDate ?? cdsDay(
          now,
          ctx,
        ),
        repeat: input.repeat,
        streak: input.streak,
        daysOfMonth: input.daysOfMonth,
        weeksOfMonth: input.weeksOfMonth,
        yesterdaily: input.yesterdaily,
      };
    case 'todo':
      return {
        ...common,
        collapseChecklist: input.collapseChecklist,
        checklist: normalizeChecklist(input.checklist),
        dueDate: input.dueDate,
      };
  }
}

async function replaceTaskTags(
  db: Db,
  taskId: string,
  tagIds: string[],
): Promise<void> {
  await db.delete(taskTags).where(eq(
    taskTags.taskId,
    taskId,
  ));
  const unique = [...new Set(tagIds)];
  if (unique.length > 0) {
    await db.insert(taskTags).values(unique.map((tagId) => ({
      taskId,
      tagId,
    })));
  }
}

function rethrowAliasConflict(error: unknown): never {
  if (isUniqueViolation(
    error,
    'tasks_user_alias_idx',
  )) {
    throw ApiError.conflict(
      'alias_taken',
      'Alias is already used by another task',
    );
  }
  throw error;
}

export async function createTasks(
  db: Db,
  user: UserRow,
  inputs: TaskCreate[],
  now: Date,
): Promise<Task[]> {
  if (inputs.length === 0) {
    return [];
  }
  const ctx = dayContext(user);
  const aliases = inputs.map((input) => input.alias).filter((alias): alias is string => alias !== null);
  if (new Set(aliases).size !== aliases.length) {
    throw ApiError.conflict(
      'alias_taken',
      'Duplicate alias in request',
    );
  }
  await assertTagsExist(
    db,
    user.id,
    inputs.flatMap((input) => input.tags),
  );

  const countByType = new Map<TaskType, number>();
  inputs.forEach((input) => countByType.set(
    input.type,
    (countByType.get(input.type) ?? 0) + 1,
  ));

  return db.transaction(async (tx) => {
    for (const [
      type,
      count,
    ] of countByType) {
      await tx
        .update(tasks)
        .set({ position: sql`${tasks.position} + ${count}` })
        .where(and(
          eq(
            tasks.userId,
            user.id,
          ),
          eq(
            tasks.type,
            type,
          ),
        ));
    }
    const nextPosition = new Map<TaskType, number>();
    const values = inputs.map((input) => {
      const position = nextPosition.get(input.type) ?? 0;
      nextPosition.set(
        input.type,
        position + 1,
      );
      return {
        ...insertValues(
          user.id,
          input,
          ctx,
          now,
        ),
        position,
      };
    });
    let rows: TaskRow[] = [];
    try {
      rows = await tx.insert(tasks).values(values).returning();
    } catch (error) {
      rethrowAliasConflict(error);
    }
    const tagRows = rows.flatMap((
      row,
      index,
    ) => [...new Set(inputs[index]?.tags ?? [])].map((tagId) => ({
      taskId: row.id,
      tagId,
    })));
    if (tagRows.length > 0) {
      await tx.insert(taskTags).values(tagRows);
    }
    return rows.map((
      row,
      index,
    ) => serializeTask(
      row,
      [...new Set(inputs[index]?.tags ?? [])],
      ctx,
      now,
    ));
  });
}

type Assign = <K extends keyof TaskInsert>(
  key: K,
  value: TaskInsert[K] | undefined,
) => void;

const typedValues: { [T in TaskType]: (
  patch: TaskUpdateFor<T>,
  assign: Assign,
) => void } = {
  habit: (
    patch,
    assign,
  ) => {
    assign(
      'up',
      patch.up,
    );
    assign(
      'down',
      patch.down,
    );
    assign(
      'counterUp',
      patch.counterUp,
    );
    assign(
      'counterDown',
      patch.counterDown,
    );
    assign(
      'frequency',
      patch.frequency,
    );
  },
  daily: (
    patch,
    assign,
  ) => {
    assign(
      'collapseChecklist',
      patch.collapseChecklist,
    );
    assign(
      'checklist',
      patch.checklist === undefined ? undefined : normalizeChecklist(patch.checklist),
    );
    assign(
      'frequency',
      patch.frequency,
    );
    assign(
      'everyX',
      patch.everyX,
    );
    assign(
      'startDate',
      patch.startDate,
    );
    assign(
      'repeat',
      patch.repeat,
    );
    assign(
      'streak',
      patch.streak,
    );
    assign(
      'daysOfMonth',
      patch.daysOfMonth,
    );
    assign(
      'weeksOfMonth',
      patch.weeksOfMonth,
    );
    assign(
      'yesterdaily',
      patch.yesterdaily,
    );
  },
  todo: (
    patch,
    assign,
  ) => {
    assign(
      'collapseChecklist',
      patch.collapseChecklist,
    );
    assign(
      'checklist',
      patch.checklist === undefined ? undefined : normalizeChecklist(patch.checklist),
    );
    assign(
      'dueDate',
      patch.dueDate,
    );
  },
};

function updateValues<T extends TaskType>(
  type: T,
  patch: TaskUpdateFor<T>,
  now: Date,
): Partial<TaskInsert> {
  const values: Partial<TaskInsert> = { updatedAt: now };
  const assign: Assign = (
    key,
    value,
  ) => {
    if (value !== undefined) {
      values[key] = value;
    }
  };
  assign(
    'text',
    patch.text,
  );
  assign(
    'notes',
    patch.notes,
  );
  assign(
    'alias',
    patch.alias,
  );
  assign(
    'reminders',
    patch.reminders === undefined ? undefined : normalizeReminders(patch.reminders),
  );
  typedValues[type](
    patch,
    assign,
  );
  return values;
}

export async function updateTask<T extends TaskType>(
  db: Db,
  user: UserRow,
  row: TaskRow & { type: T },
  patch: TaskUpdateFor<T>,
  now: Date,
): Promise<Task> {
  const ctx = dayContext(user);
  if (patch.tags !== undefined) {
    await assertTagsExist(
      db,
      user.id,
      patch.tags,
    );
  }
  const values = updateValues(
    row.type,
    patch,
    now,
  );
  if (row.type === 'daily') {
    const merged = {
      frequency: (values.frequency ?? row.frequency) as 'daily' | 'weekly' | 'monthly' | 'yearly',
      daysOfMonth: values.daysOfMonth ?? row.daysOfMonth,
      weeksOfMonth: values.weeksOfMonth ?? row.weeksOfMonth,
      repeat: values.repeat ?? row.repeat,
    };
    const problem = validateDailyRules(merged);
    if (problem) {
      throw ApiError.badRequest(problem);
    }
  }
  return db.transaction(async (tx) => {
    let updated: TaskRow | undefined;
    try {
      [updated] = await tx
        .update(tasks)
        .set(values)
        .where(eq(
          tasks.id,
          row.id,
        ))
        .returning();
    } catch (error) {
      rethrowAliasConflict(error);
    }
    if (!updated) {
      throw ApiError.notFound('Task not found');
    }
    if (patch.tags !== undefined) {
      await replaceTaskTags(
        tx,
        row.id,
        patch.tags,
      );
    }
    return serializeRow(
      tx,
      updated,
      ctx,
      now,
    );
  });
}

export async function deleteTask(
  db: Db,
  row: TaskRow,
): Promise<void> {
  await db.delete(tasks).where(eq(
    tasks.id,
    row.id,
  ));
}

async function orderedIds(
  db: Db,
  userId: string,
  type: TaskType,
): Promise<string[]> {
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(
      eq(
        tasks.userId,
        userId,
      ),
      eq(
        tasks.type,
        type,
      ),
      eq(
        tasks.completed,
        false,
      ),
    ))
    .orderBy(
      asc(tasks.position),
      desc(tasks.createdAt),
    );
  return rows.map((row) => row.id);
}

export async function moveTask(
  db: Db,
  user: UserRow,
  row: TaskRow,
  position: number,
): Promise<string[]> {
  if (row.type === 'todo' && row.completed) {
    throw ApiError.badRequest('Completed to-dos cannot be moved');
  }
  return db.transaction(async (tx) => {
    const ids = moveWithin(
      await orderedIds(
        tx,
        user.id,
        row.type,
      ),
      row.id,
      position,
    );
    await writePositions(
      tx,
      tasks,
      user.id,
      ids,
    );
    return ids;
  });
}

export async function setOrder(
  db: Db,
  user: UserRow,
  type: TaskType,
  ids: string[],
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const finalOrder = mergeOrder(
      ids,
      await orderedIds(
        tx,
        user.id,
        type,
      ),
    );
    await writePositions(
      tx,
      tasks,
      user.id,
      finalOrder,
    );
    return finalOrder;
  });
}

async function appendToOrder(
  db: Db,
  userId: string,
  row: TaskRow,
): Promise<number> {
  const [result] = await db
    .select({ max: sql<number | null>`max(${tasks.position})` })
    .from(tasks)
    .where(and(
      eq(
        tasks.userId,
        userId,
      ),
      eq(
        tasks.type,
        row.type,
      ),
      eq(
        tasks.completed,
        false,
      ),
      ne(
        tasks.id,
        row.id,
      ),
    ));
  return (result?.max ?? -1) + 1;
}

function assertScorable(
  row: TaskRow,
  direction: ScoreDirection,
): void {
  if (row.type === 'habit') {
    if ((direction === 'up' && !row.up) || (direction === 'down' && !row.down)) {
      throw ApiError.badRequest(`This habit cannot be scored ${direction}`);
    }
    return;
  }
  if (direction === 'up' && row.completed) {
    throw ApiError.conflict(
      'already_completed',
      'Task is already completed',
    );
  }
  if (direction === 'down' && !row.completed) {
    throw ApiError.conflict(
      'not_completed',
      'Task is not completed',
    );
  }
}

async function scoreOne(
  tx: Db,
  user: UserRow,
  row: TaskRow,
  direction: ScoreDirection,
  now: Date,
): Promise<ScoreResult> {
  const ctx = dayContext(user);
  assertScorable(
    row,
    direction,
  );
  const current = await serializeRow(
    tx,
    row,
    ctx,
    now,
  );
  const cdsDayOf = (date: Date) => cdsDay(
    date,
    ctx,
  );
  let values: Partial<TaskInsert> = { updatedAt: now };
  let result: ScoreResult;

  switch (current.type) {
    case 'habit': {
      const last = await lastHistoryEntry(
        tx,
        row.id,
      );
      const outcome = scoreHabit({
        task: current,
        direction,
        now,
        ctx,
        lastEntry: last ? serializeHistory(last) : null,
      });
      values = {
        ...values,
        value: outcome.task.value,
        counterUp: outcome.task.counterUp,
        counterDown: outcome.task.counterDown,
      };
      if (outcome.history) {
        await applyHistoryOp(
          tx,
          row.id,
          outcome.history,
          cdsDayOf,
        );
      }
      result = {
        task: outcome.task,
        delta: outcome.delta,
      };
      break;
    }
    case 'daily': {
      const outcome = scoreDaily({
        task: current,
        direction,
        now,
        ctx,
      });
      values = {
        ...values,
        value: outcome.task.value,
        streak: outcome.task.streak,
        completed: outcome.task.completed,
      };
      if (outcome.history) {
        await applyHistoryOp(
          tx,
          row.id,
          outcome.history,
          cdsDayOf,
        );
      }
      result = {
        task: outcome.task,
        delta: outcome.delta,
      };
      break;
    }
    case 'todo': {
      const outcome = scoreTodo({
        task: current,
        direction,
        now,
      });
      values = {
        ...values,
        value: outcome.task.value,
        completed: outcome.task.completed,
        dateCompleted: outcome.task.dateCompleted ? new Date(outcome.task.dateCompleted) : null,
      };
      if (direction === 'down') {
        const position = await appendToOrder(
          tx,
          user.id,
          row,
        );
        values.position = position;
        outcome.task.position = position;
      }
      result = {
        task: outcome.task,
        delta: outcome.delta,
      };
      break;
    }
  }

  await tx
    .update(tasks)
    .set(values)
    .where(eq(
      tasks.id,
      row.id,
    ));
  result.task.updatedAt = now.toISOString();
  return result;
}

export async function scoreTasks(
  db: Db,
  user: UserRow,
  requests: ScoreRequest[],
  now: Date,
): Promise<ScoreResult[]> {
  return db.transaction(async (tx) => {
    const results: ScoreResult[] = [];
    for (const request of requests) {
      const row = await requireTaskRow(
        tx,
        user.id,
        request.id,
      );
      results.push(await scoreOne(
        tx,
        user,
        row,
        request.direction,
        now,
      ));
    }
    return results;
  });
}

function requireChecklistTask(row: TaskRow): void {
  if (row.type === 'habit') {
    throw ApiError.badRequest('Habits do not have checklists');
  }
}

async function saveChecklist(
  db: Db,
  user: UserRow,
  row: TaskRow,
  checklist: ChecklistItem[],
  now: Date,
): Promise<Task> {
  const [updated] = await db
    .update(tasks)
    .set({
      checklist,
      updatedAt: now,
    })
    .where(eq(
      tasks.id,
      row.id,
    ))
    .returning();
  if (!updated) {
    throw ApiError.notFound('Task not found');
  }
  return serializeRow(
    db,
    updated,
    dayContext(user),
    now,
  );
}

export async function addChecklistItem(
  db: Db,
  user: UserRow,
  row: TaskRow,
  input: ChecklistItemInput,
  now: Date,
): Promise<Task> {
  requireChecklistTask(row);
  return saveChecklist(
    db,
    user,
    row,
    [
      ...row.checklist,
      {
        id: input.id ?? randomUUID(),
        text: input.text,
        completed: input.completed,
      },
    ],
    now,
  );
}

export async function updateChecklistItem(
  db: Db,
  user: UserRow,
  row: TaskRow,
  itemId: string,
  patch: ChecklistItemPatch,
  now: Date,
): Promise<Task> {
  requireChecklistTask(row);
  const index = row.checklist.findIndex((item) => item.id === itemId);
  if (index === -1) {
    throw ApiError.notFound('Checklist item not found');
  }
  const checklist = row.checklist.map((item) => (item.id === itemId
    ? {
        ...item,
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
      }
    : item));
  return saveChecklist(
    db,
    user,
    row,
    checklist,
    now,
  );
}

export async function toggleChecklistItem(
  db: Db,
  user: UserRow,
  row: TaskRow,
  itemId: string,
  now: Date,
): Promise<Task> {
  requireChecklistTask(row);
  if (!row.checklist.some((item) => item.id === itemId)) {
    throw ApiError.notFound('Checklist item not found');
  }
  return saveChecklist(
    db,
    user,
    row,
    row.checklist.map((item) => (item.id === itemId
      ? {
          ...item,
          completed: !item.completed,
        }
      : item)),
    now,
  );
}

export async function deleteChecklistItem(
  db: Db,
  user: UserRow,
  row: TaskRow,
  itemId: string,
  now: Date,
): Promise<Task> {
  requireChecklistTask(row);
  if (!row.checklist.some((item) => item.id === itemId)) {
    throw ApiError.notFound('Checklist item not found');
  }
  return saveChecklist(
    db,
    user,
    row,
    row.checklist.filter((item) => item.id !== itemId),
    now,
  );
}

export async function addTagToTask(
  db: Db,
  user: UserRow,
  row: TaskRow,
  tagId: string,
  now: Date,
): Promise<Task> {
  await assertTagsExist(
    db,
    user.id,
    [tagId],
  );
  await db
    .insert(taskTags)
    .values({
      taskId: row.id,
      tagId,
    })
    .onConflictDoNothing();
  return serializeRow(
    db,
    row,
    dayContext(user),
    now,
  );
}

export async function removeTagFromTask(
  db: Db,
  user: UserRow,
  row: TaskRow,
  tagId: string,
  now: Date,
): Promise<Task> {
  const deleted = await db
    .delete(taskTags)
    .where(and(
      eq(
        taskTags.taskId,
        row.id,
      ),
      eq(
        taskTags.tagId,
        tagId,
      ),
    ))
    .returning({ tagId: taskTags.tagId });
  if (deleted.length === 0) {
    throw ApiError.notFound('Tag is not on this task');
  }
  return serializeRow(
    db,
    row,
    dayContext(user),
    now,
  );
}

export async function deleteCompletedTodos(
  db: Db,
  userId: string,
  completedBefore?: Date,
): Promise<number> {
  const conditions: SQL[] = [
    eq(
      tasks.userId,
      userId,
    ),
    eq(
      tasks.type,
      'todo',
    ),
    eq(
      tasks.completed,
      true,
    ),
  ];
  if (completedBefore) {
    conditions.push(lt(
      tasks.dateCompleted,
      completedBefore,
    ));
  }
  const deleted = await db
    .delete(tasks)
    .where(and(...conditions))
    .returning({ id: tasks.id });
  return deleted.length;
}
