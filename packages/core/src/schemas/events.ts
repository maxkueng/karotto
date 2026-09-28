import { z } from 'zod';
import { uuidSchema } from '@karotto/core/schemas/common';
import { tagSchema } from '@karotto/core/schemas/tag';
import {
  taskSchema,
  taskTypeSchema,
} from '@karotto/core/schemas/task';
import { userSchema } from '@karotto/core/schemas/user';

export const CLIENT_ID_HEADER = 'x-client-id';

export const changeEventSchema = z.discriminatedUnion(
  'type',
  [
    z.object({
      type: z.literal('task.upserted'),
      task: taskSchema,
    }),
    z.object({
      type: z.literal('task.deleted'),
      id: uuidSchema,
    }),
    z.object({
      type: z.literal('tasks.reordered'),
      taskType: taskTypeSchema,
      ids: z.array(uuidSchema),
    }),
    z.object({ type: z.literal('tasks.invalidated') }),
    z.object({
      type: z.literal('tags.changed'),
      tags: z.array(tagSchema),
    }),
    z.object({
      type: z.literal('user.updated'),
      user: userSchema,
    }),
  ],
);
export type ChangeEvent = z.infer<typeof changeEventSchema>;

/** What goes on the wire in each SSE `data:` line. */
export const serverEventSchema = z.intersection(
  changeEventSchema,
  z.object({ origin: z.string().nullable() }),
);
export type ServerEvent = z.infer<typeof serverEventSchema>;
