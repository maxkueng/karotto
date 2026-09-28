import {
  apiTokenCreatedSchema,
  apiTokenCreateSchema,
  apiTokenSchema,
  okSchema,
  passwordChangeSchema,
  preferencesUpdateSchema,
  userSchema,
  uuidParamsSchema,
} from '@karotto/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { verifyPassword } from '@/auth/password';
import { currentUser } from '@/auth/plugin';
import type { AppContext } from '@/context';
import { ApiError } from '@/lib/errors';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from '@/services/apiTokens';
import {
  serializeUser,
  setPassword,
  updatePreferences,
} from '@/services/users';

export const userRoutes: FastifyPluginAsyncZod<AppContext> = async (
  app,
  ctx,
) => {
  app.addHook(
    'preHandler',
    app.requireAuth,
  );

  app.get(
    '/user',
    {
      schema: {
        tags: ['user'],
        response: { 200: userSchema },
      },
    },
    async (request) => serializeUser(
      currentUser(request),
      ctx.clock(),
    ),
  );

  app.patch(
    '/user/preferences',
    {
      schema: {
        tags: ['user'],
        body: preferencesUpdateSchema,
        response: { 200: userSchema },
      },
    },
    async (request) => {
      const now = ctx.clock();
      const updated = await updatePreferences(
        ctx.db,
        currentUser(request),
        request.body,
        now,
      );
      return serializeUser(
        updated,
        now,
      );
    },
  );

  app.put(
    '/user/password',
    {
      schema: {
        tags: ['user'],
        body: passwordChangeSchema,
        response: { 200: okSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      const ok = await verifyPassword(
        user.passwordHash,
        request.body.currentPassword,
      );
      if (!ok) {
        throw ApiError.invalidCredentials('Current password is wrong');
      }
      await setPassword(
        ctx.db,
        user.id,
        request.body.newPassword,
      );
      return { ok: true as const };
    },
  );

  app.get(
    '/user/tokens',
    {
      schema: {
        tags: ['tokens'],
        response: { 200: z.array(apiTokenSchema) },
      },
    },
    async (request) => listApiTokens(
      ctx.db,
      currentUser(request).id,
    ),
  );

  app.post(
    '/user/tokens',
    {
      schema: {
        tags: ['tokens'],
        body: apiTokenCreateSchema,
        response: { 201: apiTokenCreatedSchema },
      },
    },
    async (
      request,
      reply,
    ) => {
      const created = await createApiToken(
        ctx.db,
        {
          userId: currentUser(request).id,
          name: request.body.name,
          expiresAt: request.body.expiresAt ? new Date(request.body.expiresAt) : null,
          now: ctx.clock(),
        },
      );
      reply.status(201);
      return created;
    },
  );

  app.delete(
    '/user/tokens/:id',
    {
      schema: {
        tags: ['tokens'],
        params: uuidParamsSchema,
        response: { 200: okSchema },
      },
    },
    async (request) => {
      await revokeApiToken(
        ctx.db,
        currentUser(request).id,
        request.params.id,
      );
      return { ok: true as const };
    },
  );
};
