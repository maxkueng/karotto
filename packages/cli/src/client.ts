import type { ApiErrorBody } from '@karotto/core';

export class CliError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly details: unknown;

  constructor(
    code: string,
    message: string,
    exitCode = 1,
    details?: unknown,
  ) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const CLIENT_ID = `karotto-cli-${process.pid}`;

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null,
  ) {}

  url(path: string): string {
    if (!this.baseUrl) {
      throw new CliError(
        'no_server',
        'No server configured. Run `karotto login --url <url>` or set KAROTTO_URL.',
        2,
      );
    }
    return `${this.baseUrl}/api/v1${path}`;
  }

  headers(): Record<string, string> {
    return {
      accept: 'application/json',
      'x-client-id': CLIENT_ID,
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async request<T>(
    method: Method,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const target = this.url(path);
    let response: Response;
    try {
      response = await fetch(
        target,
        {
          method,
          headers: {
            ...this.headers(),
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          body: body === undefined ? null : JSON.stringify(body),
        },
      );
    } catch (error) {
      throw new CliError(
        'network',
        `Could not reach ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
        3,
      );
    }
    const text = await response.text();
    const json: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const parsed = json as Partial<ApiErrorBody> | null;
      const code = parsed?.error?.code ?? `http_${response.status}`;
      const message = parsed?.error?.message ?? response.statusText;
      throw new CliError(
        code,
        message,
        response.status === 401 ? 3 : 1,
        parsed?.error?.details,
      );
    }
    return json as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(
      'GET',
      path,
    );
  }

  post<T>(
    path: string,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>(
      'POST',
      path,
      body,
    );
  }

  patch<T>(
    path: string,
    body: unknown,
  ): Promise<T> {
    return this.request<T>(
      'PATCH',
      path,
      body,
    );
  }

  put<T>(
    path: string,
    body: unknown,
  ): Promise<T> {
    return this.request<T>(
      'PUT',
      path,
      body,
    );
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(
      'DELETE',
      path,
    );
  }
}
