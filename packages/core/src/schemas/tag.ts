import { z } from 'zod';
import {
  isoDateTimeSchema,
  NAME_MAX_LENGTH,
  uuidSchema,
} from '@karotto/core/schemas/common';

export const tagSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  position: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Tag = z.infer<typeof tagSchema>;

export const tagCreateSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
});

export const tagUpdateSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
});

export const tagOrderSchema = z.object({
  ids: z.array(uuidSchema).max(1000),
});
