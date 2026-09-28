import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
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
import { tagRoutes } from '@/routes/tags';
import { taskRoutes } from '@/routes/tasks';
import { userRoutes } from '@/routes/user';

export const API_PREFIX = '/api/v1';

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
        info: {
          title: 'karotto API',
          version: '1',
        },
        components: {
          securitySchemes: {
            bearer: {
              type: 'http',
              scheme: 'bearer',
            },
          },
        },
        security: [{ bearer: [] }],
      },
      transform: jsonSchemaTransform,
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
