import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

/**
 * Security (availability): Express 4 ignores the promise an async handler returns. If it
 * rejects, the rejection reaches `unhandledRejection`, and `index.ts` exits the process, so
 * one bad request could take the API down for every company. `audit:async-routes` lists
 * ~226 route files with async handlers and no `asyncHandler`.
 *
 * This patches Express's route layer once so a rejected handler promise goes to `next(err)`
 * and the global error handler answers with the right status. Handlers that already catch
 * their own errors are unaffected. If the response was already sent (for example
 * `asyncHandler`/`asyncSafeRouter` already forwarded the same error), the error is only logged.
 */

type LayerLike = {
  handle: (req: Request, res: Response, next: NextFunction) => unknown;
};
type LayerProto = {
  handle_request: (this: LayerLike, req: Request, res: Response, next: NextFunction) => void;
  __gatesAsyncErrors?: boolean;
};

function layerPrototype(): LayerProto {
  const probe = express.Router();
  probe.use((_req, _res, next) => next());
  const layer = (probe as unknown as { stack: object[] }).stack[0];
  return Object.getPrototypeOf(layer) as LayerProto;
}

export function installExpressAsyncErrors(): void {
  const proto = layerPrototype();
  if (proto.__gatesAsyncErrors) return;

  proto.handle_request = function handle(req, res, next) {
    const fn = this.handle;
    // Error middleware (4 args) is not a request handler; same rule as Express itself.
    if (fn.length > 3) return next();
    try {
      const result = fn(req, res, next) as { then?: unknown } | undefined;
      if (result && typeof result.then === 'function') {
        (result as Promise<unknown>).then(undefined, (err: unknown) => {
          if (res.headersSent) {
            logger.error({ err, url: req.originalUrl }, 'Async handler rejected after the response was sent');
            return;
          }
          next(err ?? new Error('Async handler rejected without a reason'));
        });
      }
    } catch (err) {
      next(err);
    }
  };
  proto.__gatesAsyncErrors = true;
}

installExpressAsyncErrors();
