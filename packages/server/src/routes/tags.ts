import {
  okSchema,
  tagCreateSchema,
  tagOrderSchema,
  tagSchema,
  tagUpdateSchema,
  uuidParamsSchema,
} from '@karotto/core';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '@/auth/plugin';
import type { AppContext } from '@/context';
import { originOf } from '@/services/events';
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

  const emitTags = async (request: FastifyRequest) => {
    const userId = currentUser(request).id;
    ctx.events.publish(
      userId,
      {
        type: 'tags.changed',
        tags: (await listTags(
          ctx.db,
          userId,
        )).map(serializeTag),
      },
      originOf(request),
    );
  };

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
      await emitTags(request);
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
    async (request) => {
      const row = await updateTag(
        ctx.db,
        currentUser(request).id,
        request.params.id,
        request.body.name,
        ctx.clock(),
      );
      await emitTags(request);
      return serializeTag(row);
    },
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
      await emitTags(request);
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
    async (request) => {
      const rows = await reorderTags(
        ctx.db,
        currentUser(request).id,
        request.body.ids,
      );
      await emitTags(request);
      return rows.map(serializeTag);
    },
  );
};
