import {
  createHash,
  randomBytes,
} from 'node:crypto';

export const API_TOKEN_PREFIX = 'krt_';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export type GeneratedApiToken = {
  token: string;
  hash: string;
  prefix: string;
};

export function generateApiToken(): GeneratedApiToken {
  const token = `${API_TOKEN_PREFIX}${randomBytes(30).toString('base64url')}`;
  return {
    token,
    hash: hashToken(token),
    prefix: token.slice(
      0,
      12,
    ),
  };
}
