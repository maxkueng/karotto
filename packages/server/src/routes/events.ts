import type { ServerEvent } from '@karotto/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { currentUser } from '@/auth/plugin';
import type { AppContext } from '@/context';

const HEARTBEAT_MS = 25_000;

function frame(
  event: ServerEvent,
  id: number,
): string {
  return `event: ${event.type}\nid: ${id}\ndata: ${JSON.stringify(event)}\n\n`;
}

export const eventRoutes: FastifyPluginAsyncZod<AppContext> = async (
  app,
  ctx,
) => {
  app.addHook(
    'preHandler',
    app.requireAuth,
  );

  const streams = new Set<() => void>();
  app.addHook(
    'onClose',
    async () => {
      streams.forEach((end) => end());
    },
  );

  app.get(
    '/events',
    {
      schema: {
        tags: ['events'],
        summary: 'Stream live changes',
        description: 'Server-sent events. Each event\'s `event:` field is one of `task.upserted`, `task.deleted`, `tasks.reordered`, `tasks.invalidated`, `tags.changed`, `user.updated`; `data:` is the JSON payload with an `origin` echoing the `X-Client-Id` header of the request that caused it. A `: ping` comment is sent every 25 seconds.',
        produces: ['text/event-stream'],
      },
    },
    async (
      request,
      reply,
    ) => {
      const user = currentUser(request);
      reply.hijack();
      const res = reply.raw;
      res.writeHead(
        200,
        {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        },
      );
      res.write(': connected\n\n');
      const unsubscribe = ctx.events.subscribe(
        user.id,
        (
          event,
          id,
        ) => {
          res.write(frame(
            event,
            id,
          ));
        },
      );
      const heartbeat = setInterval(
        () => res.write(': ping\n\n'),
        HEARTBEAT_MS,
      );
      const end = () => {
        clearInterval(heartbeat);
        unsubscribe();
        streams.delete(end);
        res.end();
      };
      streams.add(end);
      request.raw.on(
        'close',
        end,
      );
    },
  );
};
