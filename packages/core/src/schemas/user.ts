import { z } from 'zod';
import {
  isoDateTimeSchema,
  uuidSchema,
} from '@karotto/core/schemas/common';
import { isValidTimezone } from '@karotto/core/time';

export const habitFilterSchema = z.enum([
  'all',
  'weak',
  'strong',
]);
export const dailyFilterSchema = z.enum([
  'all',
  'due',
  'notDue',
]);
export const todoFilterSchema = z.enum([
  'active',
  'scheduled',
  'complete',
]);
export type HabitFilter = z.infer<typeof habitFilterSchema>;
export type DailyFilter = z.infer<typeof dailyFilterSchema>;
export type TodoFilter = z.infer<typeof todoFilterSchema>;

export const activeFilterSchema = z.object({
  habit: habitFilterSchema,
  daily: dailyFilterSchema,
  todo: todoFilterSchema,
});
export type ActiveFilter = z.infer<typeof activeFilterSchema>;

export const defaultActiveFilter: ActiveFilter = {
  habit: 'all',
  daily: 'due',
  todo: 'active',
};

export const dateFormatSchema = z.enum([
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'yyyy/MM/dd',
  'yyyy-MM-dd',
  'dd.MM.yyyy',
]);
export type DateFormat = z.infer<typeof dateFormatSchema>;

export const timezoneSchema = z.string().min(1).max(64).refine(
  isValidTimezone,
  { message: 'Unknown IANA timezone' },
);

export const preferencesSchema = z.object({
  dayStart: z.number().int().min(0).max(23),
  timezone: timezoneSchema,
  dateFormat: dateFormatSchema,
  activeFilter: activeFilterSchema,
  completedTodoRetentionDays: z.number().int().min(1).max(3650).nullable(),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const preferencesUpdateSchema = z.object({
  dayStart: z.number().int().min(0).max(23).optional(),
  timezone: timezoneSchema.optional(),
  dateFormat: dateFormatSchema.optional(),
  activeFilter: activeFilterSchema.partial().optional(),
  completedTodoRetentionDays: z.number().int().min(1).max(3650).nullable().optional(),
});
export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;

export const userSchema = z.object({
  id: uuidSchema,
  username: z.string(),
  createdAt: isoDateTimeSchema,
  lastCron: isoDateTimeSchema,
  needsCron: z.boolean(),
  preferences: preferencesSchema,
});
export type User = z.infer<typeof userSchema>;

export const usernameSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(
    /^[-_a-zA-Z0-9]+$/,
    'Usernames may only contain letters, digits, underscores and dashes',
  );

export const passwordSchema = z.string().min(8).max(256);

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  timezone: timezoneSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const tokenLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  timezone: timezoneSchema.optional(),
});
export type TokenLoginInput = z.infer<typeof tokenLoginSchema>;

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const apiTokenSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  prefix: z.string(),
  createdAt: isoDateTimeSchema,
  lastUsedAt: isoDateTimeSchema.nullable(),
  expiresAt: isoDateTimeSchema.nullable(),
});
export type ApiToken = z.infer<typeof apiTokenSchema>;

export const apiTokenCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  expiresAt: isoDateTimeSchema.nullable().default(null),
});

export const apiTokenCreatedSchema = apiTokenSchema.extend({
  token: z.string(),
});
export type ApiTokenCreated = z.infer<typeof apiTokenCreatedSchema>;
