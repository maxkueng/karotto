import {
  okSchema,
  tagCreateSchema,
  tagOrderSchema,
  tagSchema,
  tagUpdateSchema,
  uuidParamsSchema,
} from '@karotto/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '@/auth/plugin';
import type { AppContext } from '@/context';
import {
  createTag,
  deleteTag,
  listTags,
  reorderTags,
  serializeTag,
  updateTag,
} from '@/services/tags';

export const tagRoutes: FastifyPluginAsyncZod<AppContext> = async (
  app,
  ctx,
) => {
  app.addHook(
    'preHandler',
    app.requireAuth,
  );

  app.get(
    '/tags',
    {
      schema: {
        tags: ['tags'],
        response: { 200: z.array(tagSchema) },
      },
    },
    async (request) => (await listTags(
      ctx.db,
      currentUser(request).id,
    )).map(serializeTag),
  );

  app.post(
    '/tags',
    {
      schema: {
        tags: ['tags'],
        body: tagCreateSchema,
        response: { 201: tagSchema },
      },
    },
    async (
      request,
      reply,
    ) => {
      const row = await createTag(
        ctx.db,
        currentUser(request).id,
        request.body.name,
        ctx.clock(),
      );
      reply.status(201);
      return serializeTag(row);
    },
  );

  app.patch(
    '/tags/:id',
    {
      schema: {
        tags: ['tags'],
        params: uuidParamsSchema,
        body: tagUpdateSchema,
        response: { 200: tagSchema },
      },
    },
    async (request) => serializeTag(await updateTag(
      ctx.db,
      currentUser(request).id,
      request.params.id,
      request.body.name,
      ctx.clock(),
    )),
  );

  app.delete(
    '/tags/:id',
    {
      schema: {
        tags: ['tags'],
        params: uuidParamsSchema,
        response: { 200: okSchema },
      },
    },
    async (request) => {
      await deleteTag(
        ctx.db,
        currentUser(request).id,
        request.params.id,
      );
      return { ok: true as const };
    },
  );

  app.put(
    '/tags/order',
    {
      schema: {
        tags: ['tags'],
        body: tagOrderSchema,
        response: { 200: z.array(tagSchema) },
      },
    },
    async (request) => (await reorderTags(
      ctx.db,
      currentUser(request).id,
      request.body.ids,
    )).map(serializeTag),
  );
};
