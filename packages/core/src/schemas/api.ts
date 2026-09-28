import { z } from 'zod';
import { uuidSchema } from '@karotto/core/schemas/common';
import {
  scoreDirectionSchema,
  taskSchema,
  taskTypeSchema,
} from '@karotto/core/schemas/task';
import { userSchema } from '@karotto/core/schemas/user';

export const taskIdentifierSchema = z.string().min(1).max(64);

export const okSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof okSchema>;

export const uuidParamsSchema = z.object({ id: uuidSchema });

export const scoreRequestSchema = z.object({
  id: taskIdentifierSchema,
  direction: scoreDirectionSchema,
});
export type ScoreRequest = z.infer<typeof scoreRequestSchema>;

export const taskListQuerySchema = z.object({
  type: z.enum([
    'habits',
    'dailies',
    'todos',
    'completedTodos',
  ]).optional(),
});

export const bulkScoreSchema = z.object({
  scores: z.array(scoreRequestSchema).min(1).max(500),
});

export const scoreResultSchema = z.object({
  task: taskSchema,
  delta: z.number(),
});
export type ScoreResult = z.infer<typeof scoreResultSchema>;

export const bulkScoreResultSchema = z.object({
  results: z.array(scoreResultSchema),
});

export const taskOrderSchema = z.object({
  type: taskTypeSchema,
  ids: z.array(uuidSchema).max(5000),
});

export const movePositionSchema = z.object({
  position: z.coerce.number().int().min(-1),
});

export const cronStatusSchema = z.object({
  needsCron: z.boolean(),
  daysMissed: z.number().int(),
  yesterday: z.string(),
  yesterdailies: z.array(taskSchema),
});
export type CronStatus = z.infer<typeof cronStatusSchema>;

export const cronRunSchema = z.object({
  scores: z.array(scoreRequestSchema).max(500).default([]),
});

export const cronResultSchema = z.object({
  ran: z.boolean(),
  daysMissed: z.number().int(),
  user: userSchema,
});
export type CronResult = z.infer<typeof cronResultSchema>;

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof errorSchema>;
