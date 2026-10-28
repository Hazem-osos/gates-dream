import { Router, type RouterOptions } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => unknown;

export function asyncHandler(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const ROUTE_METHODS = ['all', 'get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * Express 4 does not catch a rejected promise from an async handler, and
 * `index.ts` exits the process on any unhandled rejection. So one thrown
 * `AppError` in an unwrapped handler would take the whole API down.
 * Every handler registered on this router forwards errors to `next`, which
 * lets the global error handler answer with the right status.
 */
export function asyncSafeRouter(options?: RouterOptions): Router {
  const router = Router(options);
  for (const method of ROUTE_METHODS) {
    const register = router[method].bind(router) as (...args: unknown[]) => Router;
    (router as unknown as Record<string, unknown>)[method] = (...args: unknown[]) =>
      register(...args.map((arg) => (typeof arg === 'function' ? wrapHandler(arg as AnyHandler) : arg)));
  }
  return router;
}

type AnyHandler = (...args: unknown[]) => unknown;

function wrapHandler(fn: AnyHandler): AnyHandler {
  // Error middleware is recognised by arity — leave it untouched.
  if (fn.length === 4) return fn;
  return function wrapped(req: unknown, res: unknown, next: unknown) {
    const forward = next as NextFunction;
    try {
      const result = fn(req, res, next) as { then?: unknown; catch?: (cb: (e: unknown) => void) => void } | undefined;
      if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
        result.catch(forward);
      }
      return result;
    } catch (error) {
      forward(error);
      return undefined;
    }
  };
}
