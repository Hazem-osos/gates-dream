import type { NextFunction, Request, Response } from 'express';
import { buildPayloadEtag, ifNoneMatchHit } from '../http/master-data-etag';
import { cacheControlForPath } from '../http/http-cache-policy';
import { ACCEPT_ENCODING_VARY, appendVary } from '../http/vary';

/**
 * Conditional GET for JSON responses. Prefer a version ETag already set by the
 * route; otherwise hash the payload. Matching If-None-Match → 304 empty body.
 */
export function etagMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  const originalJson = res.json.bind(res);

  res.json = function patchedJson(body: unknown): Response {
    if (res.headersSent) {
      return originalJson(body);
    }

    const status = res.statusCode || 200;
    if (status >= 400) {
      return originalJson(body);
    }

    const existing = res.getHeader('ETag');
    const etag =
      typeof existing === 'string' && existing.length > 0 ? existing : buildPayloadEtag(body);
    if (!existing) {
      res.setHeader('ETag', etag);
    }

    if (!res.getHeader('Cache-Control')) {
      const policy = cacheControlForPath(req.path);
      if (policy) res.setHeader('Cache-Control', policy);
    }

    appendVary(res, ACCEPT_ENCODING_VARY);

    if (ifNoneMatchHit(req, String(etag))) {
      res.status(304).end();
      return res;
    }

    return originalJson(body);
  };

  next();
}
