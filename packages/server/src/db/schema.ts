import type {
  ChecklistItem,
  Reminder,
  Repeat,
} from '@karotto/core';
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp(
    'created_at',
    { withTimezone: true },
  ).notNull().defaultNow(),
  updatedAt: timestamp(
    'updated_at',
    { withTimezone: true },
  ).notNull().defaultNow(),
};

export const taskTypeEnum = pgEnum(
  'task_type',
  [
    'habit',
    'daily',
    'todo',
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    lastCron: timestamp(
      'last_cron',
      { withTimezone: true },
    ).notNull().defaultNow(),
    dayStart: smallint('day_start').notNull().default(0),
    timezone: text('timezone').notNull().default('UTC'),
    dateFormat: text('date_format').notNull().default('MM/dd/yyyy'),
    completedTodoRetentionDays: integer('completed_todo_retention_days').default(30),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_username_lower_idx').on(sql`lower(${table.username})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(
      () => users.id,
      { onDelete: 'cascade' },
    ),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp(
      'created_at',
      { withTimezone: true },
    ).notNull().defaultNow(),
    lastSeenAt: timestamp(
      'last_seen_at',
      { withTimezone: true },
    ).notNull().defaultNow(),
    expiresAt: timestamp(
      'expires_at',
      { withTimezone: true },
    ).notNull(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_idx').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
  ],
);

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(
      () => users.id,
      { onDelete: 'cascade' },
    ),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    prefix: text('prefix').notNull(),
    createdAt: timestamp(
      'created_at',
      { withTimezone: true },
    ).notNull().defaultNow(),
    lastUsedAt: timestamp(
      'last_used_at',
      { withTimezone: true },
    ),
    expiresAt: timestamp(
      'expires_at',
      { withTimezone: true },
    ),
  },
  (table) => [
    uniqueIndex('api_tokens_token_hash_idx').on(table.tokenHash),
    index('api_tokens_user_idx').on(table.userId),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(
      () => users.id,
      { onDelete: 'cascade' },
    ),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('tags_user_position_idx').on(
      table.userId,
      table.position,
    ),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(
      () => users.id,
      { onDelete: 'cascade' },
    ),
    type: taskTypeEnum('type').notNull(),
    text: text('text').notNull(),
    notes: text('notes').notNull().default(''),
    alias: text('alias'),
    value: doublePrecision('value').notNull().default(0),
    position: integer('position').notNull().default(0),
    reminders: jsonb('reminders').$type<Reminder[]>().notNull().default([]),
    checklist: jsonb('checklist').$type<ChecklistItem[]>().notNull().default([]),
    collapseChecklist: boolean('collapse_checklist').notNull().default(false),
    completed: boolean('completed').notNull().default(false),
    dateCompleted: timestamp(
      'date_completed',
      { withTimezone: true },
    ),
    dueDate: date(
      'due_date',
      { mode: 'string' },
    ),
    up: boolean('up').notNull().default(true),
    down: boolean('down').notNull().default(true),
    counterUp: integer('counter_up').notNull().default(0),
    counterDown: integer('counter_down').notNull().default(0),
    frequency: text('frequency').notNull().default('daily'),
    everyX: integer('every_x').notNull().default(1),
    startDate: date(
      'start_date',
      { mode: 'string' },
    ),
    repeat: jsonb('repeat').$type<Repeat>().notNull().default({
      su: true,
      m: true,
      t: true,
      w: true,
      th: true,
      f: true,
      s: true,
    }),
    streak: integer('streak').notNull().default(0),
    daysOfMonth: jsonb('days_of_month').$type<number[]>().notNull().default([]),
    weeksOfMonth: jsonb('weeks_of_month').$type<number[]>().notNull().default([]),
    yesterdaily: boolean('yesterdaily').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index('tasks_user_type_position_idx').on(
      table.userId,
      table.type,
      table.position,
    ),
    uniqueIndex('tasks_user_alias_idx').on(
      table.userId,
      table.alias,
    ).where(sql`${table.alias} is not null`),
  ],
);

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: uuid('task_id').notNull().references(
      () => tasks.id,
      { onDelete: 'cascade' },
    ),
    tagId: uuid('tag_id').notNull().references(
      () => tags.id,
      { onDelete: 'cascade' },
    ),
  },
  (table) => [
    primaryKey({
      columns: [
        table.taskId,
        table.tagId,
      ],
    }),
    index('task_tags_tag_idx').on(table.tagId),
  ],
);

export const taskHistory = pgTable(
  'task_history',
  {
    id: bigserial(
      'id',
      { mode: 'number' },
    ).primaryKey(),
    taskId: uuid('task_id').notNull().references(
      () => tasks.id,
      { onDelete: 'cascade' },
    ),
    date: timestamp(
      'date',
      { withTimezone: true },
    ).notNull(),
    value: doublePrecision('value').notNull(),
    scoredUp: integer('scored_up'),
    scoredDown: integer('scored_down'),
    isDue: boolean('is_due'),
    completed: boolean('completed'),
  },
  (table) => [
    index('task_history_task_date_idx').on(
      table.taskId,
      table.date,
    ),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type ApiTokenRow = typeof apiTokens.$inferSelect;
export type TaskHistoryRow = typeof taskHistory.$inferSelect;
