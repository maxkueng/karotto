import {
  bulkScoreResultSchema,
  bulkScoreSchema,
  checklistItemInputSchema,
  checklistItemPatchSchema,
  historyEntrySchema,
  movePositionSchema,
  okSchema,
  scoreDirectionSchema,
  scoreResultSchema,
  taskCreateSchema,
  taskIdentifierSchema,
  taskListQuerySchema,
  taskOrderSchema,
  taskSchema,
  updateSchemaFor,
  uuidSchema,
} from '@karotto/core';
import type {
  Task,
  TaskType,
  TaskUpdateFor,
} from '@karotto/core';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '@/auth/plugin';
import type { AppContext } from '@/context';
import { ApiError } from '@/lib/errors';
import { originOf } from '@/services/events';
import { listHistory } from '@/services/history';
import { serializeHistory } from '@/services/serialize';
import {
  addChecklistItem,
  addTagToTask,
  createTasks,
  deleteCompletedTodos,
  deleteChecklistItem,
  deleteTask,
  listTasks,
  moveTask,
  removeTagFromTask,
  requireTaskRow,
  scoreTasks,
  serializeRow,
  setOrder,
  toggleChecklistItem,
  updateChecklistItem,
  updateTask,
} from '@/services/tasks';
import { dayContext } from '@/services/users';

const idParams = z.object({ id: taskIdentifierSchema });
const itemParams = z.object({
  id: taskIdentifierSchema,
  itemId: uuidSchema,
});
const tagParams = z.object({
  id: taskIdentifierSchema,
  tagId: uuidSchema,
});

export const taskRoutes: FastifyPluginAsyncZod<AppContext> = async (
  app,
  ctx,
) => {
  app.addHook(
    'preHandler',
    app.requireAuth,
  );

  const emitTask = (
    request: FastifyRequest,
    task: Task,
  ) => {
    ctx.events.publish(
      currentUser(request).id,
      {
        type: 'task.upserted',
        task,
      },
      originOf(request),
    );
    return task;
  };

  const emitOrder = (
    request: FastifyRequest,
    taskType: TaskType,
    ids: string[],
  ) => {
    ctx.events.publish(
      currentUser(request).id,
      {
        type: 'tasks.reordered',
        taskType,
        ids,
      },
      originOf(request),
    );
    return { ids };
  };

  const loadTask = async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const user = currentUser(request);
    const row = await requireTaskRow(
      ctx.db,
      user.id,
      request.params.id,
    );
    return {
      user,
      row,
    };
  };

  app.get(
    '/tasks',
    {
      schema: {
        tags: ['tasks'],
        querystring: taskListQuerySchema,
        response: { 200: z.array(taskSchema) },
      },
    },
    async (request) => listTasks(
      ctx.db,
      currentUser(request),
      request.query.type,
      ctx.clock(),
    ),
  );

  app.post(
    '/tasks',
    {
      schema: {
        tags: ['tasks'],
        body: z.union([
          taskCreateSchema,
          z.array(taskCreateSchema).min(1).max(100),
        ]),
        response: {
          201: z.union([
            taskSchema,
            z.array(taskSchema),
          ]),
        },
      },
    },
    async (
      request,
      reply,
    ) => {
      const inputs = Array.isArray(request.body) ? request.body : [request.body];
      const created = await createTasks(
        ctx.db,
        currentUser(request),
        inputs,
        ctx.clock(),
      );
      reply.status(201);
      created.forEach((task) => emitTask(
        request,
        task,
      ));
      if (Array.isArray(request.body)) {
        return created;
      }
      const [single] = created;
      if (!single) {
        throw new Error('Task creation returned nothing');
      }
      return single;
    },
  );

  app.post(
    '/tasks/score',
    {
      schema: {
        tags: ['tasks'],
        body: bulkScoreSchema,
        response: { 200: bulkScoreResultSchema },
      },
    },
    async (request) => {
      const results = await scoreTasks(
        ctx.db,
        currentUser(request),
        request.body.scores,
        ctx.clock(),
      );
      results.forEach((result) => emitTask(
        request,
        result.task,
      ));
      return { results };
    },
  );

  app.put(
    '/tasks/order',
    {
      schema: {
        tags: ['tasks'],
        body: taskOrderSchema,
        response: { 200: z.object({ ids: z.array(uuidSchema) }) },
      },
    },
    async (request) => emitOrder(
      request,
      request.body.type,
      await setOrder(
        ctx.db,
        currentUser(request),
        request.body.type,
        request.body.ids,
      ),
    ),
  );

  app.post(
    '/tasks/clear-completed',
    {
      schema: {
        tags: ['tasks'],
        response: { 200: z.object({ deleted: z.number().int() }) },
      },
    },
    async (request) => {
      const deleted = await deleteCompletedTodos(
        ctx.db,
        currentUser(request).id,
      );
      ctx.events.publish(
        currentUser(request).id,
        { type: 'tasks.invalidated' },
        originOf(request),
      );
      return { deleted };
    },
  );

  app.get(
    '/tasks/:id',
    {
      schema: {
        tags: ['tasks'],
        params: idParams,
        response: { 200: taskSchema },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      return serializeRow(
        ctx.db,
        row,
        dayContext(user),
        ctx.clock(),
      );
    },
  );

  app.patch(
    '/tasks/:id',
    {
      schema: {
        tags: ['tasks'],
        params: idParams,
        body: z.record(
          z.string(),
          z.unknown(),
        ),
        response: { 200: taskSchema },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      const parsed = updateSchemaFor(row.type).safeParse(request.body);
      if (!parsed.success) {
        throw ApiError.badRequest(
          'Invalid task update',
          parsed.error.issues,
        );
      }
      return emitTask(
        request,
        await updateTask(
          ctx.db,
          user,
          row,
          parsed.data as TaskUpdateFor<typeof row.type>,
          ctx.clock(),
        ),
      );
    },
  );

  app.delete(
    '/tasks/:id',
    {
      schema: {
        tags: ['tasks'],
        params: idParams,
        response: { 200: okSchema },
      },
    },
    async (request) => {
      const { row } = await loadTask(request);
      await deleteTask(
        ctx.db,
        row,
      );
      ctx.events.publish(
        currentUser(request).id,
        {
          type: 'task.deleted',
          id: row.id,
        },
        originOf(request),
      );
      return { ok: true as const };
    },
  );

  app.post(
    '/tasks/:id/score/:direction',
    {
      schema: {
        tags: ['tasks'],
        params: z.object({
          id: taskIdentifierSchema,
          direction: scoreDirectionSchema,
        }),
        response: { 200: scoreResultSchema },
      },
    },
    async (request) => {
      const [result] = await scoreTasks(
        ctx.db,
        currentUser(request),
        [
          {
            id: request.params.id,
            direction: request.params.direction,
          },
        ],
        ctx.clock(),
      );
      if (!result) {
        throw ApiError.notFound('Task not found');
      }
      emitTask(
        request,
        result.task,
      );
      return result;
    },
  );

  app.post(
    '/tasks/:id/move/:position',
    {
      schema: {
        tags: ['tasks'],
        params: z.object({
          id: taskIdentifierSchema,
          position: movePositionSchema.shape.position,
        }),
        response: { 200: z.object({ ids: z.array(uuidSchema) }) },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      return emitOrder(
        request,
        row.type,
        await moveTask(
          ctx.db,
          user,
          row,
          request.params.position,
        ),
      );
    },
  );

  app.get(
    '/tasks/:id/history',
    {
      schema: {
        tags: ['tasks'],
        params: idParams,
        response: { 200: z.array(historyEntrySchema) },
      },
    },
    async (request) => {
      const { row } = await loadTask(request);
      return (await listHistory(
        ctx.db,
        row.id,
      )).map(serializeHistory);
    },
  );

  app.post(
    '/tasks/:id/checklist',
    {
      schema: {
        tags: ['checklist'],
        params: idParams,
        body: checklistItemInputSchema,
        response: { 200: taskSchema },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      return emitTask(
        request,
        await addChecklistItem(
          ctx.db,
          user,
          row,
          request.body,
          ctx.clock(),
        ),
      );
    },
  );

  app.patch(
    '/tasks/:id/checklist/:itemId',
    {
      schema: {
        tags: ['checklist'],
        params: itemParams,
        body: checklistItemPatchSchema,
        response: { 200: taskSchema },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      return emitTask(
        request,
        await updateChecklistItem(
          ctx.db,
          user,
          row,
          request.params.itemId,
          request.body,
          ctx.clock(),
        ),
      );
    },
  );

  app.post(
    '/tasks/:id/checklist/:itemId/score',
    {
      schema: {
        tags: ['checklist'],
        params: itemParams,
        response: { 200: taskSchema },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      return emitTask(
        request,
        await toggleChecklistItem(
          ctx.db,
          user,
          row,
          request.params.itemId,
          ctx.clock(),
        ),
      );
    },
  );

  app.delete(
    '/tasks/:id/checklist/:itemId',
    {
      schema: {
        tags: ['checklist'],
        params: itemParams,
        response: { 200: taskSchema },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      return emitTask(
        request,
        await deleteChecklistItem(
          ctx.db,
          user,
          row,
          request.params.itemId,
          ctx.clock(),
        ),
      );
    },
  );

  app.post(
    '/tasks/:id/tags/:tagId',
    {
      schema: {
        tags: ['tasks'],
        params: tagParams,
        response: { 200: taskSchema },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      return emitTask(
        request,
        await addTagToTask(
          ctx.db,
          user,
          row,
          request.params.tagId,
          ctx.clock(),
        ),
      );
    },
  );

  app.delete(
    '/tasks/:id/tags/:tagId',
    {
      schema: {
        tags: ['tasks'],
        params: tagParams,
        response: { 200: taskSchema },
      },
    },
    async (request) => {
      const {
        user,
        row,
      } = await loadTask(request);
      return emitTask(
        request,
        await removeTagFromTask(
          ctx.db,
          user,
          row,
          request.params.tagId,
          ctx.clock(),
        ),
      );
    },
  );
};
