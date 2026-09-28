import { CLIENT_ID_HEADER } from '@karotto/core';
import type {
  ChangeEvent,
  ServerEvent,
} from '@karotto/core';
import type { FastifyRequest } from 'fastify';

export type EventListener = (
  event: ServerEvent,
  id: number,
) => void;

const MAX_ORIGIN_LENGTH = 64;

/** In-process fan-out of change events to each user's open event streams. */
export class EventHub {
  private readonly listeners = new Map<string, Set<EventListener>>();
  private sequence = 0;

  subscribe(
    userId: string,
    listener: EventListener,
  ): () => void {
    const set = this.listeners.get(userId) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(
      userId,
      set,
    );
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(userId);
      }
    };
  }

  publish(
    userId: string,
    event: ChangeEvent,
    origin: string | null,
  ): void {
    const set = this.listeners.get(userId);
    if (!set) {
      return;
    }
    this.sequence += 1;
    const id = this.sequence;
    const payload: ServerEvent = {
      ...event,
      origin,
    };
    set.forEach((listener) => listener(
      payload,
      id,
    ));
  }

  connections(userId: string): number {
    return this.listeners.get(userId)?.size ?? 0;
  }
}

export function originOf(request: FastifyRequest): string | null {
  const header = request.headers[CLIENT_ID_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ORIGIN_LENGTH) {
    return null;
  }
  return value;
}
