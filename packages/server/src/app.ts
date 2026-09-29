import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import authPlugin from '@/auth/plugin';
import type { AppContext } from '@/context';
import { ApiError } from '@/lib/errors';
import { authRoutes } from '@/routes/auth';
import { cronRoutes } from '@/routes/cron';
import { eventRoutes } from '@/routes/events';
import { tagRoutes } from '@/routes/tags';
import { taskRoutes } from '@/routes/tasks';
import { userRoutes } from '@/routes/user';

export const API_PREFIX = '/api/v1';

const API_DESCRIPTION = `Habitica's task model without the game: habits, dailies and to-dos with value colours, streaks, checklists, tags, reminders and a custom day start.

**Authentication.** Every route except \`/auth/login\` and \`/auth/token\` needs either the session cookie a browser gets from \`/auth/login\`, or an API token sent as \`Authorization: Bearer krt_…\`. Create tokens in Settings, with \`karotto token create <user>\` on the server, or with \`POST /auth/token\`. Use the **Authorize** button above to try requests here.

**Ids and aliases.** Wherever a path takes a task id you may pass the task's alias instead.

**Day rollover.** karotto does not run a scheduler. Clients call \`GET /cron/status\` and \`POST /cron\` when they open, exactly like Habitica; a script that scores today's dailies before any app has been opened should run the rollover first.

**Live updates.** \`GET /events\` streams changes as server-sent events. Send an \`X-Client-Id\` header on writes and the same value is echoed as \`origin\` on the resulting events so a client can ignore its own.

**Errors** are \`{ "error": { "code", "message", "details?" } }\` with a matching HTTP status; \`401 unauthorized\`, \`404 not_found\`, \`409\` for conflicts such as \`tag_exists\` and \`cron_running\`, \`400 validation\` with zod issues in \`details\`.

**Rate limit.** 600 requests per minute per user.`;

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: ctx.config.LOG_LEVEL,
      ...(ctx.config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
    trustProxy: ctx.config.TRUST_PROXY,
    bodyLimit: 1_048_576,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cookie);
  await app.register(
    rateLimit,
    {
      global: true,
      max: 600,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.user?.id ?? request.ip,
    },
  );
  await app.register(
    swagger,
    {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'karotto API',
          version: '1',
          description: API_DESCRIPTION,
        },
        tags: [
          {
            name: 'auth',
            description: 'Sessions for browsers, tokens for everything else.',
          },
          {
            name: 'user',
            description: 'The current account, its preferences and API tokens.',
          },
          {
            name: 'tasks',
            description: 'Habits, dailies and to-dos. Ids and aliases are interchangeable in paths.',
          },
          {
            name: 'checklist',
            description: 'Checklist items on dailies and to-dos.',
          },
          {
            name: 'tags',
            description: 'Tags, unique per user by name.',
          },
          {
            name: 'cron',
            description: 'The day rollover, triggered by clients.',
          },
          {
            name: 'events',
            description: 'Live change stream over server-sent events.',
          },
        ],
        components: {
          securitySchemes: {
            bearer: {
              type: 'http',
              scheme: 'bearer',
              description: 'A long-lived API token, `krt_…`, from Settings, the CLI or `POST /auth/token`.',
            },
            session: {
              type: 'apiKey',
              in: 'cookie',
              name: 'karotto_session',
              description: 'Browser session cookie set by `POST /auth/login`.',
            },
          },
        },
        security: [
          { bearer: [] },
          { session: [] },
        ],
      },
      transform: jsonSchemaTransform,
    },
  );
  await app.register(
    swaggerUi,
    {
      routePrefix: `${API_PREFIX}/docs`,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        persistAuthorization: true,
      },
      theme: {
        title: 'karotto API',
        css: [
          {
            filename: 'karotto.css',
            content: '.swagger-ui .topbar { display: none; }',
          },
        ],
      },
    },
  );
  await app.register(
    authPlugin,
    {
      db: ctx.db,
      clock: ctx.clock,
      sessionTtlDays: ctx.config.SESSION_TTL_DAYS,
    },
  );

  app.setErrorHandler((
    error,
    request,
    reply,
  ) => {
    if (error instanceof ApiError) {
      void reply.status(error.status).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
      return;
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      void reply.status(400).send({
        error: {
          code: 'validation',
          message: 'Request validation failed',
          details: error.validation,
        },
      });
      return;
    }
    if (isResponseSerializationError(error)) {
      request.log.error(
        error,
        'response serialization failed',
      );
      void reply.status(500).send({
        error: {
          code: 'internal',
          message: 'Internal error',
        },
      });
      return;
    }
    const known = error as {
      statusCode?: unknown;
      code?: unknown;
      message?: unknown;
    };
    const status = typeof known.statusCode === 'number' ? known.statusCode : 500;
    if (status >= 500) {
      request.log.error(error);
      void reply.status(status).send({
        error: {
          code: 'internal',
          message: 'Internal error',
        },
      });
      return;
    }
    void reply.status(status).send({
      error: {
        code: status === 429 ? 'rate_limited' : typeof known.code === 'string' ? known.code : 'error',
        message: typeof known.message === 'string' ? known.message : 'Request failed',
      },
    });
  });

  await app.register(
    async (api) => {
      api.get(
        '/openapi.json',
        { schema: { hide: true } },
        async () => app.swagger(),
      );
      api.get(
        '/health',
        { schema: { hide: true } },
        async () => ({ ok: true }),
      );
      await api.register(
        authRoutes,
        ctx,
      );
      await api.register(
        userRoutes,
        ctx,
      );
      await api.register(
        tagRoutes,
        ctx,
      );
      await api.register(
        taskRoutes,
        ctx,
      );
      await api.register(
        cronRoutes,
        ctx,
      );
      await api.register(
        eventRoutes,
        ctx,
      );
    },
    { prefix: API_PREFIX },
  );

  const staticDir = ctx.config.STATIC_DIR ? resolve(ctx.config.STATIC_DIR) : null;
  const serveStatic = staticDir !== null && existsSync(staticDir);
  if (serveStatic) {
    await app.register(
      fastifyStatic,
      {
        root: staticDir,
        wildcard: false,
        index: false,
      },
    );
  }
  app.setNotFoundHandler((
    request,
    reply,
  ) => {
    if (!serveStatic || request.url.startsWith(`${API_PREFIX}/`)) {
      void reply.status(404).send({
        error: {
          code: 'not_found',
          message: 'Route not found',
        },
      });
      return;
    }
    void reply.sendFile('index.html');
  });

  return app;
}
