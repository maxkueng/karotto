import { z } from 'zod';
import {
  isoDateSchema,
  isoDateTimeSchema,
  isUuid,
  NOTES_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  uuidSchema,
} from '@karotto/core/schemas/common';

export const taskTypeSchema = z.enum([
  'habit',
  'daily',
  'todo',
]);
export type TaskType = z.infer<typeof taskTypeSchema>;

export const scoreDirectionSchema = z.enum([
  'up',
  'down',
]);
export type ScoreDirection = z.infer<typeof scoreDirectionSchema>;

export const repeatDayKeys = [
  'su',
  'm',
  't',
  'w',
  'th',
  'f',
  's',
] as const;
export type RepeatDayKey = (typeof repeatDayKeys)[number];

export const repeatSchema = z.object({
  su: z.boolean(),
  m: z.boolean(),
  t: z.boolean(),
  w: z.boolean(),
  th: z.boolean(),
  f: z.boolean(),
  s: z.boolean(),
});
export type Repeat = z.infer<typeof repeatSchema>;

export const everyDay: Repeat = {
  su: true,
  m: true,
  t: true,
  w: true,
  th: true,
  f: true,
  s: true,
};

export const checklistItemSchema = z.object({
  id: uuidSchema,
  text: z.string().max(TEXT_MAX_LENGTH),
  completed: z.boolean(),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const reminderSchema = z.object({
  id: uuidSchema,
  time: isoDateTimeSchema,
  startDate: isoDateSchema.nullable(),
});
export type Reminder = z.infer<typeof reminderSchema>;

export const dailyFrequencySchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'yearly',
]);
export type DailyFrequency = z.infer<typeof dailyFrequencySchema>;

export const habitFrequencySchema = z.enum([
  'daily',
  'weekly',
  'monthly',
]);
export type HabitFrequency = z.infer<typeof habitFrequencySchema>;

export const aliasSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-zA-Z0-9-_]+$/,
    'Aliases may only contain letters, digits, underscores and dashes',
  )
  .refine(
    (value) => !isUuid(value),
    { message: 'Aliases cannot be UUIDs' },
  );

const textSchema = z.string().trim().min(
  1,
  'Title is required',
).max(TEXT_MAX_LENGTH);
const notesSchema = z.string().max(NOTES_MAX_LENGTH);
const everyXSchema = z.number().int().min(1).max(9999);
const daysOfMonthSchema = z.array(z.number().int().min(1).max(31)).max(31);
const weeksOfMonthSchema = z.array(z.number().int().min(0).max(4)).max(5);
const counterSchema = z.number().int().min(0);

const taskBaseSchema = z.object({
  id: uuidSchema,
  type: taskTypeSchema,
  text: z.string(),
  notes: z.string(),
  alias: z.string().nullable(),
  value: z.number(),
  tags: z.array(uuidSchema),
  reminders: z.array(reminderSchema),
  position: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const habitSchema = taskBaseSchema.extend({
  type: z.literal('habit'),
  up: z.boolean(),
  down: z.boolean(),
  counterUp: z.number().int(),
  counterDown: z.number().int(),
  frequency: habitFrequencySchema,
});
export type Habit = z.infer<typeof habitSchema>;

export const dailySchema = taskBaseSchema.extend({
  type: z.literal('daily'),
  completed: z.boolean(),
  collapseChecklist: z.boolean(),
  checklist: z.array(checklistItemSchema),
  frequency: dailyFrequencySchema,
  everyX: z.number().int(),
  startDate: isoDateSchema,
  repeat: repeatSchema,
  streak: z.number().int(),
  daysOfMonth: z.array(z.number().int()),
  weeksOfMonth: z.array(z.number().int()),
  yesterdaily: z.boolean(),
  isDue: z.boolean(),
});
export type Daily = z.infer<typeof dailySchema>;

export const todoSchema = taskBaseSchema.extend({
  type: z.literal('todo'),
  completed: z.boolean(),
  collapseChecklist: z.boolean(),
  checklist: z.array(checklistItemSchema),
  dueDate: isoDateSchema.nullable(),
  dateCompleted: isoDateTimeSchema.nullable(),
});
export type Todo = z.infer<typeof todoSchema>;

export const taskSchema = z.discriminatedUnion(
  'type',
  [
    habitSchema,
    dailySchema,
    todoSchema,
  ],
);
export type Task = z.infer<typeof taskSchema>;

export const checklistItemInputSchema = z.object({
  id: uuidSchema.optional(),
  text: z.string().max(TEXT_MAX_LENGTH),
  completed: z.boolean().default(false),
});
export type ChecklistItemInput = z.infer<typeof checklistItemInputSchema>;

export const checklistItemPatchSchema = z.object({
  text: z.string().max(TEXT_MAX_LENGTH).optional(),
  completed: z.boolean().optional(),
});
export type ChecklistItemPatch = z.infer<typeof checklistItemPatchSchema>;

export const reminderInputSchema = z.object({
  id: uuidSchema.optional(),
  time: isoDateTimeSchema,
  startDate: isoDateSchema.nullable().default(null),
});
export type ReminderInput = z.infer<typeof reminderInputSchema>;

const createBase = {
  text: textSchema,
  notes: notesSchema.default(''),
  alias: aliasSchema.nullable().default(null),
  tags: z.array(uuidSchema).max(200).default([]),
  reminders: z.array(reminderInputSchema).max(50).default([]),
};

const checklistInput = {
  collapseChecklist: z.boolean().default(false),
  checklist: z.array(checklistItemInputSchema).max(200).default([]),
};

export const habitCreateSchema = z.object({
  type: z.literal('habit'),
  ...createBase,
  up: z.boolean().default(true),
  down: z.boolean().default(true),
  counterUp: counterSchema.default(0),
  counterDown: counterSchema.default(0),
  frequency: habitFrequencySchema.default('daily'),
});

function monthlyRuleIsComplete(daily: {
  frequency: DailyFrequency;
  daysOfMonth: number[];
  weeksOfMonth: number[];
  repeat: Repeat;
}): boolean {
  if (daily.frequency !== 'monthly') {
    return true;
  }
  if (daily.weeksOfMonth.length > 0) {
    return repeatDayKeys.some((key) => daily.repeat[key]);
  }
  return daily.daysOfMonth.length > 0;
}

const monthlyRuleMessage = {
  message: 'A monthly daily needs either days of the month or weeks of the month with at least one weekday',
  path: ['daysOfMonth'],
};

export const dailyCreateSchema = z
  .object({
    type: z.literal('daily'),
    ...createBase,
    ...checklistInput,
    frequency: dailyFrequencySchema.default('weekly'),
    everyX: everyXSchema.default(1),
    startDate: isoDateSchema.optional(),
    repeat: repeatSchema.default(everyDay),
    streak: counterSchema.default(0),
    daysOfMonth: daysOfMonthSchema.default([]),
    weeksOfMonth: weeksOfMonthSchema.default([]),
    yesterdaily: z.boolean().default(true),
  })
  .refine(
    monthlyRuleIsComplete,
    monthlyRuleMessage,
  );

export const todoCreateSchema = z.object({
  type: z.literal('todo'),
  ...createBase,
  ...checklistInput,
  dueDate: isoDateSchema.nullable().default(null),
});

export const taskCreateSchema = z.discriminatedUnion(
  'type',
  [
    habitCreateSchema,
    dailyCreateSchema,
    todoCreateSchema,
  ],
);
export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskCreateInput = z.input<typeof taskCreateSchema>;
export type HabitCreate = z.infer<typeof habitCreateSchema>;
export type DailyCreate = z.infer<typeof dailyCreateSchema>;
export type TodoCreate = z.infer<typeof todoCreateSchema>;

const updateBase = {
  text: textSchema.optional(),
  notes: notesSchema.optional(),
  alias: aliasSchema.nullable().optional(),
  tags: z.array(uuidSchema).max(200).optional(),
  reminders: z.array(reminderInputSchema).max(50).optional(),
};

const checklistUpdate = {
  collapseChecklist: z.boolean().optional(),
  checklist: z.array(checklistItemInputSchema).max(200).optional(),
};

export const habitUpdateSchema = z.object({
  ...updateBase,
  up: z.boolean().optional(),
  down: z.boolean().optional(),
  counterUp: counterSchema.optional(),
  counterDown: counterSchema.optional(),
  frequency: habitFrequencySchema.optional(),
});
export type HabitUpdate = z.infer<typeof habitUpdateSchema>;

export const dailyUpdateSchema = z.object({
  ...updateBase,
  ...checklistUpdate,
  frequency: dailyFrequencySchema.optional(),
  everyX: everyXSchema.optional(),
  startDate: isoDateSchema.optional(),
  repeat: repeatSchema.optional(),
  streak: counterSchema.optional(),
  daysOfMonth: daysOfMonthSchema.optional(),
  weeksOfMonth: weeksOfMonthSchema.optional(),
  yesterdaily: z.boolean().optional(),
});
export type DailyUpdate = z.infer<typeof dailyUpdateSchema>;

export const todoUpdateSchema = z.object({
  ...updateBase,
  ...checklistUpdate,
  dueDate: isoDateSchema.nullable().optional(),
});
export type TodoUpdate = z.infer<typeof todoUpdateSchema>;

export type TaskUpdate = HabitUpdate | DailyUpdate | TodoUpdate;

export type TaskUpdateFor<T extends TaskType> = T extends 'habit' ? HabitUpdate : T extends 'daily' ? DailyUpdate : TodoUpdate;

export function updateSchemaFor(type: TaskType) {
  switch (type) {
    case 'habit':
      return habitUpdateSchema;
    case 'daily':
      return dailyUpdateSchema;
    case 'todo':
      return todoUpdateSchema;
  }
}

export function validateDailyRules(daily: {
  frequency: DailyFrequency;
  daysOfMonth: number[];
  weeksOfMonth: number[];
  repeat: Repeat;
}): string | null {
  return monthlyRuleIsComplete(daily) ? null : monthlyRuleMessage.message;
}

export const historyEntrySchema = z.object({
  date: isoDateTimeSchema,
  value: z.number(),
  scoredUp: z.number().int().nullable(),
  scoredDown: z.number().int().nullable(),
  isDue: z.boolean().nullable(),
  completed: z.boolean().nullable(),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
