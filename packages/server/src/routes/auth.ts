import {
  loginSchema,
  okSchema,
  userSchema,
} from '@karotto/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { SESSION_COOKIE } from '@/auth/plugin';
import type { AppContext } from '@/context';
import { ApiError } from '@/lib/errors';
import {
  createSession,
  deleteSession,
} from '@/services/sessions';
import {
  authenticate,
  serializeUser,
  updatePreferences,
} from '@/services/users';

export const authRoutes: FastifyPluginAsyncZod<AppContext> = async (
  app,
  ctx,
) => {
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      schema: {
        tags: ['auth'],
        body: loginSchema,
        response: { 200: userSchema },
      },
    },
    async (
      request,
      reply,
    ) => {
      const now = ctx.clock();
      let user = await authenticate(
        ctx.db,
        request.body.username,
        request.body.password,
      );
      if (!user) {
        throw ApiError.invalidCredentials('Invalid username or password');
      }
      if (request.body.timezone && request.body.timezone !== user.timezone) {
        user = await updatePreferences(
          ctx.db,
          user,
          { timezone: request.body.timezone },
          now,
        );
      }
      const token = await createSession(
        ctx.db,
        {
          userId: user.id,
          userAgent: request.headers['user-agent'] ?? null,
          ttlDays: ctx.config.SESSION_TTL_DAYS,
          now,
        },
      );
      reply.setCookie(
        SESSION_COOKIE,
        token,
        {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: ctx.config.secureCookies,
          maxAge: ctx.config.SESSION_TTL_DAYS * 86_400,
        },
      );
      return serializeUser(
        user,
        now,
      );
    },
  );

  app.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        response: { 200: okSchema },
      },
    },
    async (
      request,
      reply,
    ) => {
      if (request.sessionToken) {
        await deleteSession(
          ctx.db,
          request.sessionToken,
        );
      }
      reply.clearCookie(
        SESSION_COOKIE,
        { path: '/' },
      );
      return { ok: true as const };
    },
  );

  app.get(
    '/auth/session',
    {
      schema: {
        tags: ['auth'],
        response: { 200: userSchema },
      },
    },
    async (request) => {
      if (!request.user) {
        throw ApiError.unauthorized();
      }
      return serializeUser(
        request.user,
        ctx.clock(),
      );
    },
  );
};
