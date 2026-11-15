import { CLIENT_ID_HEADER } from '@karotto/core';
import type { ApiErrorBody } from '@karotto/core';
import type { Method } from '@/api/transport';
import { transport } from '@/api/transport';
import { newId } from '@/lib/ids';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type { Method } from '@/api/transport';
export { BASE } from '@/api/transport';

/** Identifies this tab so its own changes can be told apart on the event stream. */
export const CLIENT_ID = newId();

const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await transport().send(
    method,
    path,
    body,
    {
      [CLIENT_ID_HEADER]: CLIENT_ID,
      ...headers,
    },
  );
  const json = response.body;
  if (response.status >= 400) {
    const parsed = json as Partial<ApiErrorBody> | null;
    const code = parsed?.error?.code ?? 'error';
    const message = parsed?.error?.message ?? response.statusText;
    if (response.status === 401 && code === 'unauthorized') {
      unauthorizedListeners.forEach((listener) => listener());
    }
    throw new ApiRequestError(
      response.status,
      code,
      message,
      parsed?.error?.details,
    );
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(
    'GET',
    path,
  ),
  post: <T>(
    path: string,
    body?: unknown,
  ) => request<T>(
    'POST',
    path,
    body,
  ),
  patch: <T>(
    path: string,
    body?: unknown,
  ) => request<T>(
    'PATCH',
    path,
    body,
  ),
  put: <T>(
    path: string,
    body?: unknown,
  ) => request<T>(
    'PUT',
    path,
    body,
  ),
  delete: <T>(path: string) => request<T>(
    'DELETE',
    path,
  ),
};
