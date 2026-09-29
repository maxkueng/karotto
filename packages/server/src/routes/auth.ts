import {
  apiTokenCreatedSchema,
  loginSchema,
  okSchema,
  tokenLoginSchema,
  userSchema,
} from '@karotto/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { SESSION_COOKIE } from '@/auth/plugin';
import type { AppContext } from '@/context';
import { ApiError } from '@/lib/errors';
import { createApiToken } from '@/services/apiTokens';
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
        summary: 'Log in with username and password',
        description: 'Starts a browser session and sets the `karotto_session` cookie. Scripts should use `POST /auth/token` instead.',
        security: [],
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
    '/auth/token',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      schema: {
        tags: ['auth'],
        summary: 'Exchange credentials for an API token',
        description: 'Creates a named long-lived token, the flow the Android app uses at login. The plain token is returned once; store it.',
        security: [],
        body: tokenLoginSchema,
        response: { 201: apiTokenCreatedSchema },
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
      const created = await createApiToken(
        ctx.db,
        {
          userId: user.id,
          name: request.body.name,
          expiresAt: null,
          now,
        },
      );
      reply.status(201);
      return created;
    },
  );

  app.post(
    '/auth/logout',
    {
      schema: {
        summary: 'End the current session',
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
        summary: 'Current user for the session or token',
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
