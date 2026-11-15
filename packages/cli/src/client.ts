import {
  API_REVISION_HEADER,
  BASELINE_API_REVISION,
} from '@karotto/core';
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
  serverRevision: number | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null,
    private readonly onServerRevision?: (revision: number) => void,
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
    this.recordServerRevision(response);
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

  /** Only a successful answer without the header is trusted to come from an older karotto, not a proxy. */
  private recordServerRevision(response: Response): void {
    const header = Number(response.headers.get(API_REVISION_HEADER) ?? Number.NaN);
    const revision = Number.isInteger(header) ? header : (response.ok ? BASELINE_API_REVISION : null);
    if (revision === null) {
      return;
    }
    this.serverRevision = revision;
    this.onServerRevision?.(revision);
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
