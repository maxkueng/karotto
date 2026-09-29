import {
  cronResultSchema,
  cronRunSchema,
  cronStatusSchema,
} from '@karotto/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { currentUser } from '@/auth/plugin';
import type { AppContext } from '@/context';
import {
  cronStatus,
  runCron,
} from '@/services/cron';
import { originOf } from '@/services/events';
import { serializeUser } from '@/services/users';

export const cronRoutes: FastifyPluginAsyncZod<AppContext> = async (
  app,
  ctx,
) => {
  app.addHook(
    'preHandler',
    app.requireAuth,
  );

  app.get(
    '/cron/status',
    {
      schema: {
        summary: 'Check whether a day rollover is pending',
        description: 'Also lists yesterday\'s due, unfinished dailies so a client can ask which were actually done.',
        tags: ['cron'],
        response: { 200: cronStatusSchema },
      },
    },
    async (request) => cronStatus(
      ctx.db,
      currentUser(request),
      ctx.clock(),
    ),
  );

  app.post(
    '/cron',
    {
      schema: {
        summary: 'Run the day rollover',
        description: 'Optionally scores the listed dailies first, then resets dailies, decays missed ones, records history and advances `lastCron`. Safe to call when nothing is pending; returns `ran: false`.',
        tags: ['cron'],
        body: cronRunSchema.nullish(),
        response: { 200: cronResultSchema },
      },
    },
    async (request) => {
      const now = ctx.clock();
      const result = await runCron(
        ctx.db,
        currentUser(request),
        {
          scores: request.body?.scores ?? [],
          now,
        },
      );
      const user = serializeUser(
        result.user,
        now,
      );
      if (result.ran) {
        const origin = originOf(request);
        ctx.events.publish(
          user.id,
          { type: 'tasks.invalidated' },
          origin,
        );
        ctx.events.publish(
          user.id,
          {
            type: 'user.updated',
            user,
          },
          origin,
        );
      }
      return {
        ran: result.ran,
        daysMissed: result.daysMissed,
        user,
      };
    },
  );
};
