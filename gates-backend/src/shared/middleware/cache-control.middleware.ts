import type { NextFunction, Request, Response } from 'express';
import { cacheControlForPath } from '../http/http-cache-policy';

/**
 * Default Cache-Control for GET/HEAD API responses. Route helpers may overwrite
 * (e.g. sendJsonWithEtag, auth no-store).
 */
export function cacheControlMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  if (!res.getHeader('Cache-Control')) {
    const policy = cacheControlForPath(req.path);
    if (policy) res.setHeader('Cache-Control', policy);
  }
  next();
}
