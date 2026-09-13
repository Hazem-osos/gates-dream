import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

/**
 * Query Limits Middleware
 * Enforces maximum result set size and requires pagination for large queries
 */

export interface QueryLimitOptions {
  maxResults?: number; // Maximum results without pagination (default: 1000)
  defaultLimit?: number; // Default limit if not specified (default: 50)
  maxLimit?: number; // Maximum allowed limit (default: 1000)
}

const DEFAULT_OPTIONS: Required<QueryLimitOptions> = {
  maxResults: 1000,
  defaultLimit: 50,
  maxLimit: 1000,
};

/**
 * Query limits middleware factory
 */
export const queryLimits = (options: QueryLimitOptions = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const query = req.query as Record<string, string | undefined>;

    // Parse limit and skip from query
    let limit = query.limit ? parseInt(query.limit, 10) : opts.defaultLimit;
    const skip = query.skip ? parseInt(query.skip, 10) : 0;

    // Validate limit
    if (isNaN(limit) || limit < 1) {
      limit = opts.defaultLimit;
    }

    // Enforce maximum limit
    if (limit > opts.maxLimit) {
      logger.warn(
        {
          requestedLimit: limit,
          maxLimit: opts.maxLimit,
          path: req.path,
          ip: req.ip,
        },
        'Query limit exceeded maximum, using max limit'
      );
      limit = opts.maxLimit;
    }

    // Check if query would return too many results without pagination
    if (!query.limit && !query.skip && limit >= opts.maxResults) {
      logger.warn(
        {
          limit,
          maxResults: opts.maxResults,
          path: req.path,
          ip: req.ip,
        },
        'Query requires pagination but none provided'
      );
      return void res.status(400).json({
        status: 'error',
        message: `Query requires pagination. Maximum ${opts.maxResults} results allowed without pagination. Please use 'limit' and 'skip' query parameters.`,
        maxResults: opts.maxResults,
      });
    }

    // Set validated limit and skip in query
    req.query.limit = limit.toString();
    req.query.skip = skip.toString();

    // Add pagination info to response headers
    res.setHeader('X-Query-Limit', limit.toString());
    res.setHeader('X-Query-Skip', skip.toString());
    res.setHeader('X-Query-Max-Limit', opts.maxLimit.toString());

    next();
  };
};

/**
 * Default query limits middleware
 */
export const defaultQueryLimits = queryLimits();

