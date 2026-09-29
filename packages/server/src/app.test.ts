import type { FastifyInstance } from 'fastify';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import {
  API_PREFIX,
  buildApp,
} from '@/app';
import { loadConfig } from '@/config';
import type { DbHandle } from '@/db/client';
import { createTestDb } from '@/db/testDb';
import { EventHub } from '@/services/events';
import { createUser } from '@/services/users';

let handle: DbHandle;
let app: FastifyInstance;
let now = new Date('2026-09-28T10:00:00Z');
let cookie = '';

type Json = Record<string, unknown>;

type Payload = Record<string, unknown> | unknown[];

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  body?: Payload,
  headers: Record<string, string> = {},
) {
  const response = await app.inject({
    method,
    url: `${API_PREFIX}${url}`,
    headers: {
      cookie,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
  return {
    status: response.statusCode,
    body: response.body ? (JSON.parse(response.body) as Json) : null,
    raw: response,
  };
}

beforeAll(async () => {
  handle = await createTestDb();
  await createUser(
    handle.db,
    {
      username: 'max',
      password: 'correct horse battery',
      timezone: 'Europe/Zurich',
    },
    now,
  );
  app = await buildApp({
    db: handle.db,
    clock: () => now,
    config: loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'unused',
      LOG_LEVEL: 'silent',
    }),
    events: new EventHub(),
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await handle.close();
});

describe(
  'auth',
  () => {
    it(
      'rejects unauthenticated requests',
      async () => {
        const {
          status,
          body,
        } = await call(
          'GET',
          '/user',
        );
        expect(status).toBe(401);
        expect((body?.error as Json).code).toBe('unauthorized');
      },
    );

    it(
      'rejects bad credentials',
      async () => {
        const { status } = await call(
          'POST',
          '/auth/login',
          {
            username: 'max',
            password: 'wrong',
          },
        );
        expect(status).toBe(401);
      },
    );

    it(
      'logs in with a session cookie',
      async () => {
        const {
          status,
          body,
          raw,
        } = await call(
          'POST',
          '/auth/login',
          {
            username: 'Max',
            password: 'correct horse battery',
          },
        );
        expect(status).toBe(200);
        expect(body?.username).toBe('max');
        const setCookie = raw.headers['set-cookie'];
        const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        expect(header).toContain('karotto_session=');
        expect(header).toContain('HttpOnly');
        cookie = header?.split(';')[0] ?? '';
      },
    );

    it(
      'returns the user with needsCron false',
      async () => {
        const {
          status,
          body,
        } = await call(
          'GET',
          '/user',
        );
        expect(status).toBe(200);
        expect(body?.needsCron).toBe(false);
        expect((body?.preferences as Json).timezone).toBe('Europe/Zurich');
      },
    );
  },
);

describe(
  'tags and tasks',
  () => {
    let tagId = '';
    let habitId = '';
    let dailyId = '';
    let todoId = '';

    it(
      'creates a tag',
      async () => {
        const {
          status,
          body,
        } = await call(
          'POST',
          '/tags',
          { name: 'work' },
        );
        expect(status).toBe(201);
        tagId = body?.id as string;
      },
    );

    it(
      'rejects unknown tags on tasks',
      async () => {
        const { status } = await call(
          'POST',
          '/tasks',
          {
            type: 'habit',
            text: 'x',
            tags: ['11111111-1111-4111-8111-111111111111'],
          },
        );
        expect(status).toBe(400);
      },
    );

    it(
      'creates tasks of each type with defaults',
      async () => {
        const habit = await call(
          'POST',
          '/tasks',
          {
            type: 'habit',
            text: 'Drink water',
            alias: 'water',
            tags: [tagId],
          },
        );
        expect(habit.status).toBe(201);
        expect(habit.body?.up).toBe(true);
        expect(habit.body?.frequency).toBe('daily');
        habitId = habit.body?.id as string;

        const daily = await call(
          'POST',
          '/tasks',
          {
            type: 'daily',
            text: 'Stretch',
            checklist: [
              { text: 'neck' },
              { text: 'back' },
            ],
          },
        );
        expect(daily.status).toBe(201);
        expect(daily.body?.startDate).toBe('2026-09-28');
        expect(daily.body?.isDue).toBe(true);
        expect((daily.body?.checklist as Json[]).length).toBe(2);
        dailyId = daily.body?.id as string;

        const todo = await call(
          'POST',
          '/tasks',
          {
            type: 'todo',
            text: 'File taxes',
            dueDate: '2026-10-01',
          },
        );
        expect(todo.status).toBe(201);
        todoId = todo.body?.id as string;
      },
    );

    it(
      'rejects monthly dailies without a rule',
      async () => {
        const { status } = await call(
          'POST',
          '/tasks',
          {
            type: 'daily',
            text: 'Rent',
            frequency: 'monthly',
          },
        );
        expect(status).toBe(400);
      },
    );

    it(
      'puts new tasks at the top of their column',
      async () => {
        const second = await call(
          'POST',
          '/tasks',
          {
            type: 'habit',
            text: 'Second habit',
          },
        );
        const list = await call(
          'GET',
          '/tasks?type=habits',
        );
        const ids = (list.body as unknown as Json[]).map((task) => task.id);
        expect(ids).toEqual([
          second.body?.id,
          habitId,
        ]);
      },
    );

    it(
      'finds tasks by alias',
      async () => {
        const {
          status,
          body,
        } = await call(
          'GET',
          '/tasks/water',
        );
        expect(status).toBe(200);
        expect(body?.id).toBe(habitId);
      },
    );

    it(
      'refuses duplicate aliases',
      async () => {
        const {
          status,
          body,
        } = await call(
          'POST',
          '/tasks',
          {
            type: 'todo',
            text: 'dup',
            alias: 'water',
          },
        );
        expect(status).toBe(409);
        expect((body?.error as Json).code).toBe('alias_taken');
      },
    );

    it(
      'scores a habit up and records history',
      async () => {
        const {
          status,
          body,
        } = await call(
          'POST',
          '/tasks/water/score/up',
        );
        expect(status).toBe(200);
        expect(body?.delta).toBeCloseTo(
          1,
          5,
        );
        expect((body?.task as Json).counterUp).toBe(1);
        const history = await call(
          'GET',
          `/tasks/${habitId}/history`,
        );
        expect((history.body as unknown as Json[]).length).toBe(1);
        await call(
          'POST',
          '/tasks/water/score/down',
        );
        const again = await call(
          'GET',
          `/tasks/${habitId}/history`,
        );
        expect((again.body as unknown as Json[]).length).toBe(1);
        expect((again.body as unknown as Json[])[0]?.scoredDown).toBe(1);
      },
    );

    it(
      'refuses scoring a disabled habit direction',
      async () => {
        await call(
          'PATCH',
          `/tasks/${habitId}`,
          { down: false },
        );
        const { status } = await call(
          'POST',
          '/tasks/water/score/down',
        );
        expect(status).toBe(400);
        await call(
          'PATCH',
          `/tasks/${habitId}`,
          { down: true },
        );
      },
    );

    it(
      'checks and unchecks a daily',
      async () => {
        const up = await call(
          'POST',
          `/tasks/${dailyId}/score/up`,
        );
        expect(up.status).toBe(200);
        expect((up.body?.task as Json).completed).toBe(true);
        expect((up.body?.task as Json).streak).toBe(1);
        const again = await call(
          'POST',
          `/tasks/${dailyId}/score/up`,
        );
        expect(again.status).toBe(409);
        const down = await call(
          'POST',
          `/tasks/${dailyId}/score/down`,
        );
        expect((down.body?.task as Json).completed).toBe(false);
        expect((down.body?.task as Json).streak).toBe(0);
        expect((down.body?.task as Json).value).toBeCloseTo(
          0,
          4,
        );
        const history = await call(
          'GET',
          `/tasks/${dailyId}/history`,
        );
        expect(history.body).toEqual([]);
      },
    );

    it(
      'toggles checklist items',
      async () => {
        const task = await call(
          'GET',
          `/tasks/${dailyId}`,
        );
        const item = (task.body?.checklist as Json[])[0] as Json;
        const toggled = await call(
          'POST',
          `/tasks/${dailyId}/checklist/${item.id as string}/score`,
        );
        expect(((toggled.body?.checklist as Json[])[0] as Json).completed).toBe(true);
        const added = await call(
          'POST',
          `/tasks/${dailyId}/checklist`,
          { text: 'legs' },
        );
        expect((added.body?.checklist as Json[]).length).toBe(3);
        const removed = await call(
          'DELETE',
          `/tasks/${dailyId}/checklist/${item.id as string}`,
        );
        expect((removed.body?.checklist as Json[]).length).toBe(2);
      },
    );

    it(
      'completes a todo and moves it out of the active list',
      async () => {
        const done = await call(
          'POST',
          `/tasks/${todoId}/score/up`,
        );
        expect((done.body?.task as Json).completed).toBe(true);
        expect((done.body?.task as Json).dateCompleted).toBe(now.toISOString());
        const active = await call(
          'GET',
          '/tasks?type=todos',
        );
        expect((active.body as unknown as Json[]).some((task) => task.id === todoId)).toBe(false);
        const completed = await call(
          'GET',
          '/tasks?type=completedTodos',
        );
        expect((completed.body as unknown as Json[]).map((task) => task.id)).toEqual([todoId]);
        const move = await call(
          'POST',
          `/tasks/${todoId}/move/0`,
        );
        expect(move.status).toBe(400);
        await call(
          'POST',
          `/tasks/${todoId}/score/down`,
        );
      },
    );

    it(
      'moves and reorders tasks',
      async () => {
        const list = await call(
          'GET',
          '/tasks?type=habits',
        );
        const ids = (list.body as unknown as Json[]).map((task) => task.id as string);
        const moved = await call(
          'POST',
          `/tasks/${ids[1] ?? ''}/move/0`,
        );
        expect(moved.body?.ids).toEqual([
          ids[1],
          ids[0],
        ]);
        const ordered = await call(
          'PUT',
          '/tasks/order',
          {
            type: 'habit',
            ids,
          },
        );
        expect(ordered.body?.ids).toEqual(ids);
        const after = await call(
          'GET',
          '/tasks?type=habits',
        );
        expect((after.body as unknown as Json[]).map((task) => task.id)).toEqual(ids);
      },
    );

    it(
      'adds and removes tags on a task',
      async () => {
        const removed = await call(
          'DELETE',
          `/tasks/${habitId}/tags/${tagId}`,
        );
        expect(removed.body?.tags).toEqual([]);
        const added = await call(
          'POST',
          `/tasks/${habitId}/tags/${tagId}`,
        );
        expect(added.body?.tags).toEqual([tagId]);
        await call(
          'DELETE',
          `/tags/${tagId}`,
        );
        const task = await call(
          'GET',
          `/tasks/${habitId}`,
        );
        expect(task.body?.tags).toEqual([]);
      },
    );

    it(
      'validates updates per type',
      async () => {
        const bad = await call(
          'PATCH',
          `/tasks/${dailyId}`,
          { everyX: 0 },
        );
        expect(bad.status).toBe(400);
        const ok = await call(
          'PATCH',
          `/tasks/${dailyId}`,
          {
            frequency: 'weekly',
            repeat: {
              su: false,
              m: true,
              t: false,
              w: false,
              th: false,
              f: false,
              s: false,
            },
          },
        );
        expect(ok.status).toBe(200);
        expect(ok.body?.isDue).toBe(true);
      },
    );

    it(
      'deletes a task',
      async () => {
        const { status } = await call(
          'DELETE',
          `/tasks/${todoId}`,
        );
        expect(status).toBe(200);
        const gone = await call(
          'GET',
          `/tasks/${todoId}`,
        );
        expect(gone.status).toBe(404);
      },
    );
  },
);

describe(
  'tag names',
  () => {
    it(
      'rejects duplicate names per user, ignoring case',
      async () => {
        const first = await call(
          'POST',
          '/tags',
          { name: 'Errands' },
        );
        expect(first.status).toBe(201);
        const dupe = await call(
          'POST',
          '/tags',
          { name: 'errands ' },
        );
        expect(dupe.status).toBe(409);
        expect((dupe.body as { error: { code: string } }).error.code).toBe('tag_exists');
        const other = await call(
          'POST',
          '/tags',
          { name: 'Chores' },
        );
        const rename = await call(
          'PATCH',
          `/tags/${(other.body as { id: string }).id}`,
          { name: 'ERRANDS' },
        );
        expect(rename.status).toBe(409);
      },
    );
  },
);

describe(
  'cron',
  () => {
    it(
      'reports nothing to do on the same day',
      async () => {
        const { body } = await call(
          'GET',
          '/cron/status',
        );
        expect(body?.needsCron).toBe(false);
        const run = await call(
          'POST',
          '/cron',
        );
        expect(run.status).toBe(200);
        expect(run.body?.ran).toBe(false);
      },
    );

    it(
      'lists yesterdailies after a day boundary and rolls over',
      async () => {
        await call(
          'POST',
          '/tasks',
          {
            type: 'todo',
            text: 'Decaying todo',
          },
        );
        now = new Date('2026-09-29T07:00:00Z');
        const user = await call(
          'GET',
          '/user',
        );
        expect(user.body?.needsCron).toBe(true);

        const status = await call(
          'GET',
          '/cron/status',
        );
        expect(status.body?.daysMissed).toBe(1);
        expect(status.body?.yesterday).toBe('2026-09-28');
        const candidates = (status.body?.yesterdailies as Json[]).map((task) => task.text);
        expect(candidates).toEqual(['Stretch']);

        const dailyId = (status.body?.yesterdailies as Json[])[0]?.id as string;
        const run = await call(
          'POST',
          '/cron',
          {
            scores: [
              {
                id: dailyId,
                direction: 'up',
              },
            ],
          },
        );
        expect(run.status).toBe(200);
        expect(run.body?.ran).toBe(true);
        expect((run.body?.user as Json).needsCron).toBe(false);

        const daily = await call(
          'GET',
          `/tasks/${dailyId}`,
        );
        expect(daily.body?.completed).toBe(false);
        expect(daily.body?.streak).toBe(1);
        expect(daily.body?.value).toBeCloseTo(
          1,
          4,
        );
        expect(daily.body?.isDue).toBe(false);

        const todos = await call(
          'GET',
          '/tasks?type=todos',
        );
        const decaying = (todos.body as unknown as Json[]).find((task) => task.text === 'Decaying todo');
        expect(decaying?.value).toBeCloseTo(
          -1,
          4,
        );
      },
    );

    it(
      'penalises a missed daily on the next rollover',
      async () => {
        now = new Date('2026-10-05T09:00:00Z');
        const status = await call(
          'GET',
          '/cron/status',
        );
        expect(status.body?.daysMissed).toBe(6);
        expect((status.body?.yesterdailies as Json[]).length).toBe(0);
        const dailies = (await call(
          'GET',
          '/tasks?type=dailies',
        )).body as unknown as Json[];
        const patched = await call(
          'PATCH',
          `/tasks/${dailies[0]?.id as string}`,
          {
            repeat: {
              su: true,
              m: true,
              t: true,
              w: true,
              th: true,
              f: true,
              s: true,
            },
          },
        );
        expect(patched.status).toBe(200);
        const run = await call(
          'POST',
          '/cron',
        );
        expect(run.body?.ran).toBe(true);
        const daily = ((await call(
          'GET',
          '/tasks?type=dailies',
        )).body as unknown as Json[])[0] as Json;
        expect(daily.streak).toBe(0);
        expect(daily.value as number).toBeLessThan(1);
      },
    );
  },
);

describe(
  'token login',
  () => {
    it(
      'issues a named token for valid credentials',
      async () => {
        const saved = cookie;
        cookie = '';
        const {
          status,
          body,
        } = await call(
          'POST',
          '/auth/token',
          {
            username: 'max',
            password: 'correct horse battery',
            name: 'phone',
          },
        );
        expect(status).toBe(201);
        expect((body?.token as string).startsWith('krt_')).toBe(true);
        const viaToken = await call(
          'GET',
          '/user',
          undefined,
          { authorization: `Bearer ${body?.token as string}` },
        );
        expect(viaToken.status).toBe(200);
        const bad = await call(
          'POST',
          '/auth/token',
          {
            username: 'max',
            password: 'wrong',
            name: 'phone',
          },
        );
        expect(bad.status).toBe(401);
        cookie = saved;
      },
    );
  },
);

describe(
  'api tokens',
  () => {
    it(
      'creates a token and authenticates with it',
      async () => {
        const created = await call(
          'POST',
          '/user/tokens',
          { name: 'script' },
        );
        expect(created.status).toBe(201);
        const token = created.body?.token as string;
        expect(token.startsWith('krt_')).toBe(true);

        const saved = cookie;
        cookie = '';
        const viaToken = await call(
          'GET',
          '/user',
          undefined,
          { authorization: `Bearer ${token}` },
        );
        expect(viaToken.status).toBe(200);
        const badToken = await call(
          'GET',
          '/user',
          undefined,
          { authorization: 'Bearer krt_nope' },
        );
        expect(badToken.status).toBe(401);
        expect((badToken.body?.error as Json).code).toBe('invalid_credentials');
        cookie = saved;

        const list = await call(
          'GET',
          '/user/tokens',
        );
        const tokens = list.body as unknown as Json[];
        expect(tokens.some((token) => token.id === created.body?.id)).toBe(true);
        expect(tokens.every((token) => token.token === undefined)).toBe(true);
        const revoked = await call(
          'DELETE',
          `/user/tokens/${created.body?.id as string}`,
        );
        expect(revoked.status).toBe(200);
      },
    );

    it(
      'logs out',
      async () => {
        const { status } = await call(
          'POST',
          '/auth/logout',
        );
        expect(status).toBe(200);
        const after = await call(
          'GET',
          '/user',
        );
        expect(after.status).toBe(401);
      },
    );
  },
);

describe(
  'openapi',
  () => {
    it(
      'serves the spec',
      async () => {
        const {
          status,
          body,
        } = await call(
          'GET',
          '/openapi.json',
        );
        expect(status).toBe(200);
        expect(Object.keys(body?.paths as Json)).toContain('/api/v1/tasks/{id}/score/{direction}');
      },
    );
  },
);

describe(
  'content types',
  () => {
    it(
      'accepts body-less posts sent with a non-JSON content type',
      async () => {
        const login = await call(
          'POST',
          '/auth/token',
          {
            username: 'max',
            password: 'correct horse battery',
            name: 'automation test',
          },
        );
        const bearer = { authorization: `Bearer ${(login.body as { token: string }).token}` };
        const created = await call(
          'POST',
          '/tasks',
          {
            type: 'habit',
            text: 'automation',
          },
          bearer,
        );
        const id = (created.body as { id: string }).id;
        const response = await app.inject({
          method: 'POST',
          url: `${API_PREFIX}/tasks/${id}/score/up`,
          headers: {
            ...bearer,
            'content-type': 'application/x-www-form-urlencoded',
          },
        });
        expect(response.statusCode).toBe(200);
        const withBody = await app.inject({
          method: 'POST',
          url: `${API_PREFIX}/tasks/${id}/score/up`,
          headers: {
            ...bearer,
            'content-type': 'application/x-www-form-urlencoded',
          },
          payload: 'task=shower',
        });
        expect(withBody.statusCode).toBe(415);
      },
    );
  },
);

describe(
  'docs',
  () => {
    it(
      'serves the OpenAPI spec with summaries and the interactive UI',
      async () => {
        const spec = await app.inject({
          method: 'GET',
          url: `${API_PREFIX}/openapi.json`,
        });
        expect(spec.statusCode).toBe(200);
        const paths = spec.json<{ paths: Record<string, Record<string, {
          summary?: string;
          security?: unknown[];
        }>>; }>().paths;
        expect(paths['/api/v1/tasks/{id}/score/{direction}']?.post?.summary).toBe('Score a task up or down');
        expect(Object.keys(paths).length).toBeGreaterThan(20);
        expect(paths['/api/v1/auth/token']?.post?.security).toEqual([]);
        const ui = await app.inject({
          method: 'GET',
          url: `${API_PREFIX}/docs/`,
        });
        expect(ui.statusCode).toBe(200);
        expect(ui.headers['content-type']).toContain('text/html');
      },
    );
  },
);

describe(
  'events',
  () => {
    it(
      'streams changes made by other clients and marks the origin',
      async () => {
        const address = await app.listen({
          host: '127.0.0.1',
          port: 0,
        });
        const login = await call(
          'POST',
          '/auth/token',
          {
            username: 'max',
            password: 'correct horse battery',
            name: 'events test',
          },
        );
        expect(login.status).toBe(201);
        const token = (login.body as { token: string }).token;
        const bearer = { authorization: `Bearer ${token}` };
        const created = await call(
          'POST',
          '/tasks',
          {
            type: 'habit',
            text: 'streamed',
          },
          bearer,
        );
        expect(created.status).toBe(201);
        const taskId = (created.body as { id: string }).id;
        const controller = new AbortController();
        const response = await fetch(
          `${address}/api/v1/events`,
          {
            headers: { authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        expect(response.headers.get('content-type')).toContain('text/event-stream');
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let received = '';
        const readUntil = async (marker: string) => {
          while (!received.includes(marker)) {
            const chunk = await reader.read();
            if (chunk.done) {
              break;
            }
            received += decoder.decode(chunk.value);
          }
        };
        await readUntil(': connected');
        const scored = await call(
          'POST',
          `/tasks/${taskId}/score/up`,
          undefined,
          {
            ...bearer,
            'x-client-id': 'web-abc',
          },
        );
        expect(scored.status).toBe(200);
        await readUntil('event: task.upserted');
        const data = received.split('\n').find((line) => line.startsWith('data: '));
        const event = JSON.parse(data!.slice('data: '.length)) as {
          type: string;
          origin: string;
          task: {
            id: string;
            counterUp: number;
          };
        };
        expect(event.origin).toBe('web-abc');
        expect(event.task.id).toBe(taskId);
        expect(event.task.counterUp).toBe(1);
        controller.abort();
        await reader.cancel().catch(() => undefined);
      },
    );
  },
);
