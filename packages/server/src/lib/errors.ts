export type ErrorCode
  = 'validation'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'invalid_credentials'
    | 'rate_limited'
    | 'internal';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | string;
  readonly details: unknown;

  constructor(
    status: number,
    code: ErrorCode | string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(
    message: string,
    details?: unknown,
  ): ApiError {
    return new ApiError(
      400,
      'validation',
      message,
      details,
    );
  }

  static invalidCredentials(message: string): ApiError {
    return new ApiError(
      401,
      'invalid_credentials',
      message,
    );
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(
      401,
      'unauthorized',
      message,
    );
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(
      404,
      'not_found',
      message,
    );
  }

  static conflict(
    code: string,
    message: string,
  ): ApiError {
    return new ApiError(
      409,
      code,
      message,
    );
  }
}

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const record = error as {
    code?: unknown;
    constraint_name?: unknown;
    constraint?: unknown;
    cause?: unknown;
  };
  if (record.code !== UNIQUE_VIOLATION) {
    return record.cause !== undefined && isUniqueViolation(
      record.cause,
      constraint,
    );
  }
  if (!constraint) {
    return true;
  }
  return record.constraint_name === constraint || record.constraint === constraint;
}
