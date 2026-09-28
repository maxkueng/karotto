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
      return {
        ran: result.ran,
        daysMissed: result.daysMissed,
        user: serializeUser(
          result.user,
          now,
        ),
      };
    },
  );
};
