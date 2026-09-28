import '@fastify/cookie';
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import { API_TOKEN_PREFIX } from '@/auth/tokens';
import type { Db } from '@/db/client';
import type { UserRow } from '@/db/schema';
import type { Clock } from '@/lib/clock';
import { ApiError } from '@/lib/errors';
import { resolveApiToken } from '@/services/apiTokens';
import { resolveSession } from '@/services/sessions';

export const SESSION_COOKIE = 'karotto_session';

export type AuthKind = 'session' | 'token';

/* eslint-disable @typescript-eslint/consistent-type-definitions -- module augmentation requires interfaces */
declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow | null;
    authKind: AuthKind | null;
    sessionToken: string | null;
  }
  interface FastifyInstance {
    requireAuth: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}
/* eslint-enable @typescript-eslint/consistent-type-definitions */

export type AuthPluginOptions = {
  db: Db;
  clock: Clock;
  sessionTtlDays: number;
};

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (
  app,
  options,
) => {
  app.decorateRequest(
    'user',
    null,
  );
  app.decorateRequest(
    'authKind',
    null,
  );
  app.decorateRequest(
    'sessionToken',
    null,
  );

  app.addHook(
    'onRequest',
    async (request) => {
      const now = options.clock();
      const header = request.headers.authorization;
      if (typeof header === 'string' && header.startsWith('Bearer ')) {
        const token = header.slice('Bearer '.length).trim();
        if (!token.startsWith(API_TOKEN_PREFIX)) {
          throw ApiError.unauthorized('Malformed API token');
        }
        const user = await resolveApiToken(
          options.db,
          token,
          now,
        );
        if (!user) {
          throw ApiError.invalidCredentials('Invalid or expired API token');
        }
        request.user = user;
        request.authKind = 'token';
        return;
      }
      const cookie = request.cookies[SESSION_COOKIE];
      if (cookie) {
        const user = await resolveSession(
          options.db,
          cookie,
          options.sessionTtlDays,
          now,
        );
        if (user) {
          request.user = user;
          request.authKind = 'session';
          request.sessionToken = cookie;
        }
      }
    },
  );

  app.decorate(
    'requireAuth',
    async (request: FastifyRequest) => {
      if (!request.user) {
        throw ApiError.unauthorized();
      }
    },
  );
};

export default fp(
  authPlugin,
  { name: 'karotto-auth' },
);

export function currentUser(request: FastifyRequest): UserRow {
  if (!request.user) {
    throw ApiError.unauthorized();
  }
  return request.user;
}
