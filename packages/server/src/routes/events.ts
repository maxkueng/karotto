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
        description: 'Server-sent events stream of changes to the current user\'s data',
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
