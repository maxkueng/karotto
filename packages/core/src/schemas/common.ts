import { z } from 'zod';
import { isIsoDate } from '@karotto/core/civil';

export const uuidSchema = z.uuid();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export const isoDateSchema = z.string().refine(
  isIsoDate,
  { message: 'Expected a calendar date in YYYY-MM-DD form' },
);

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const TEXT_MAX_LENGTH = 5000;
export const NOTES_MAX_LENGTH = 20000;
export const NAME_MAX_LENGTH = 200;
