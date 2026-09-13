/**
 * Global Error Handler — Gates ERP
 *
 * Single source of truth for all HTTP error responses.
 * Must be registered as the LAST middleware in app.ts.
 *
 * Handled error types (in priority order):
 *  1. ZodError        → 400  { status, message, errors[] }
 *  2. AppError        → statusCode from the instance
 *  3. Prisma P2002    → 409  Unique constraint violation
 *  4. Prisma P2025    → 404  Record not found
 *  5. Prisma P2003    → 409  Foreign key constraint violation
 *  6. Everything else → 500  (details hidden in production)
 *
 * Naming note:
 *  `AppError` is the canonical class.
 *  `ApiError` is a named alias exported for modules that prefer that name.
 *  Both refer to the same class — there is no behaviour difference.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../logger';

// ── AppError (canonical) ──────────────────────────────────────────────────────

/**
 * Operational error with an explicit HTTP status code.
 *
 * Use this for all known, intentional error conditions:
 *   throw new AppError(404, 'User not found');
 *   throw new AppError(409, 'Email already exists');
 *
 * `isOperational = true`  → message is safe to surface to the client.
 * `isOperational = false` → treat like an unexpected crash (hidden in prod).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Named alias — use either `AppError` or `ApiError`; they are identical.
 *
 * @example
 *   import { ApiError } from '../shared/middleware/error-handler';
 *   throw new ApiError(400, 'Bad request');
 */
export const ApiError = AppError;
export type ApiError = AppError;

// ── Prisma error helpers ──────────────────────────────────────────────────────

function handlePrismaError(err: Prisma.PrismaClientKnownRequestError): AppError {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint failed — surface the conflicting field if available
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(', ')
        : 'field';
      return new AppError(409, `A record with this ${target} already exists.`);
    }
    case 'P2025':
      // Record to update/delete not found
      return new AppError(404, err.meta?.cause as string ?? 'Record not found.');
    case 'P2003':
      // Foreign key constraint failed
      return new AppError(409, 'Operation failed: a related record does not exist.');
    case 'P2014':
      // Required relation violation
      return new AppError(400, 'Invalid data: a required relation is missing.');
    default:
      // Unknown Prisma error — log internally, return generic 500
      return new AppError(500, 'A database error occurred.', false);
  }
}

// ── Central error handler middleware ─────────────────────────────────────────

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  if (res.headersSent || res.writableEnded) {
    logger.error({ err, url: req.url, method: req.method }, 'Error after response already started');
    return;
  }

  // Always log — use `debug` level for 4xx (client errors), `error` for 5xx
  const logMeta = {
    err,
    url: req.url,
    method: req.method,
    userId: ((req as unknown) as { user?: { sub: string } }).user?.sub,
    tenantId: ((req as unknown) as { tenantId?: string }).tenantId,
  };

  // ── 1. ZodError — validation failure ────────────────────────────────────────
  if (err instanceof ZodError) {
    logger.debug(logMeta, 'Validation error');
    res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // ── 2. Prisma known request errors ──────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const appError = handlePrismaError(err);
    logger.warn({ ...logMeta, prismaCode: err.code }, `Prisma error → ${appError.statusCode}`);
    res.status(appError.statusCode).json({
      status: 'error',
      message: appError.message,
    });
    return;
  }

  // ── 3. AppError — known operational error ───────────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    const level = err.statusCode >= 500 ? 'error' : 'debug';
    logger[level](logMeta, `AppError ${err.statusCode}: ${err.message}`);

    const safeMessage =
      isProduction && err.statusCode >= 500
        ? 'An error occurred while processing your request'
        : err.message;

    const details = 'details' in err ? (err as { details?: unknown }).details : undefined;
    const code = 'code' in err ? (err as { code?: unknown }).code : undefined;
    res.status(err.statusCode).json({
      status: 'error',
      message: safeMessage,
      ...(typeof code === 'string' ? { code } : {}),
      ...(details != null ? { details } : {}),
      ...(isDevelopment && err.statusCode >= 500 && { originalMessage: err.message }),
    });
    return;
  }

  // ── 4. Unknown / unexpected error ───────────────────────────────────────────
  logger.error(logMeta, 'Unhandled error');

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = isProduction
    ? 'An internal server error occurred'
    : err instanceof Error
      ? err.message
      : String(err);

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(isDevelopment && {
      stack: err instanceof Error ? err.stack : undefined,
    }),
  });
};
