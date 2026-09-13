import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

/**
 * Request Timeout Middleware
 * Prevents hanging requests from consuming resources
 */

export interface TimeoutOptions {
  timeout: number; // Timeout in milliseconds
  onTimeout?: (req: Request, res: Response) => void;
  skip?: (req: Request) => boolean;
}

const TIMEOUT_LOCALS_KEY = 'gatesRequestTimeoutId';

function isHeadersAlreadySent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_HTTP_HEADERS_SENT'
  );
}

function clearStoredTimeout(res: Response) {
  const existing = res.locals[TIMEOUT_LOCALS_KEY];
  if (existing) {
    clearTimeout(existing as NodeJS.Timeout);
    res.locals[TIMEOUT_LOCALS_KEY] = undefined;
  }
}

function safeTimeoutResponse(
  req: Request,
  res: Response,
  timeout: number,
  onTimeout?: TimeoutOptions['onTimeout']
) {
  if (res.headersSent || res.writableEnded) return;

  logger.warn(
    {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      timeout,
      ip: req.ip,
    },
    'Request timeout'
  );

  try {
    if (onTimeout) {
      onTimeout(req, res);
      return;
    }
    if (res.headersSent || res.writableEnded) return;
    res.status(408).json({
      status: 'error',
      message: 'Request timeout',
    });
  } catch (error) {
    if (!isHeadersAlreadySent(error)) {
      logger.error({ error, path: req.path }, 'Failed to write timeout response');
    }
  }
}

/**
 * Create request timeout middleware.
 * A later, route-specific timeout replaces the earlier global one so AI/report
 * requests are not killed by the 30s default and then double-written.
 */
export const requestTimeout = (options: TimeoutOptions) => {
  const { timeout, onTimeout, skip } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) {
      next();
      return;
    }

    clearStoredTimeout(res);

    const timeoutId = setTimeout(() => {
      res.locals[TIMEOUT_LOCALS_KEY] = undefined;
      safeTimeoutResponse(req, res, timeout, onTimeout);
    }, timeout);

    res.locals[TIMEOUT_LOCALS_KEY] = timeoutId;

    const clear = () => clearStoredTimeout(res);
    res.once('finish', clear);
    res.once('close', clear);

    next();
  };
};

/**
 * Default request timeout (30 seconds)
 */
function requestPath(req: Request): string {
  return (req.originalUrl || req.url || req.path).split('?')[0] ?? '';
}

export const defaultRequestTimeout = requestTimeout({
  timeout: 30000, // 30 seconds
  skip: (req) => requestPath(req).startsWith('/api/v1/ai'),
});

/**
 * Extended request timeout for reports (60 seconds)
 */
export const reportRequestTimeout = requestTimeout({
  timeout: 60000, // 60 seconds
});

/**
 * OpenAI chat + tool loops can exceed the reports window.
 * Must stay below the frontend stream timeout (180s).
 */
export const aiRequestTimeout = requestTimeout({
  timeout: 180000,
});
