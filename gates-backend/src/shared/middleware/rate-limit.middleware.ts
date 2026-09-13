import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../logger';
import { recordViolation } from './ip-blocking.middleware';

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP address
 */

const API_RATE_WINDOW_MS = 15 * 60 * 1000;

/**
 * ERP pages fire dozens of API calls per navigation. 100/15min (the old
 * production default) locks out a single clerk — and when the Next.js
 * rewrite proxies every browser request, Express used to see one shared
 * IP for the whole tenant. Default is now ERP-sized; override with
 * API_RATE_LIMIT_MAX if needed.
 */
const API_RATE_MAX = Number.parseInt(process.env.API_RATE_LIMIT_MAX ?? '', 10) || 5000;

const AUTH_RATE_MAX =
  Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '', 10) || 30;

const REFRESH_RATE_MAX =
  Number.parseInt(process.env.AUTH_REFRESH_RATE_LIMIT_MAX ?? '', 10) || 60;

/** Login / session bootstrap must not share the general API bucket. */
export function isAuthRateLimitBypassPath(req: Request): boolean {
  const url = `${req.originalUrl || ''} ${req.path || ''}`;
  return /\/auth\/(login|register|logout|refresh|me|verify|profile)(\/|\?|$)/i.test(url);
}

export const apiRateLimiter = rateLimit({
  windowMs: API_RATE_WINDOW_MS,
  max: API_RATE_MAX,
  skip: isAuthRateLimitBypassPath,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    await recordViolation(ip);

    logger.warn(
      {
        ip,
        path: req.path,
        method: req.method,
      },
      'Rate limit exceeded'
    );
    return void res.status(429).json({
      status: 'error',
      message: 'Too many requests from this IP, please try again later.',
    });
  },
});

/**
 * Brute-force shield for login/register only (not /me, /verify, /refresh).
 * Successful logins are not counted.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: AUTH_RATE_MAX,
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: async (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    await recordViolation(ip);

    logger.warn(
      {
        ip,
        path: req.path,
        method: req.method,
      },
      'Auth rate limit exceeded'
    );
    return void res.status(429).json({
      status: 'error',
      message: 'Too many authentication attempts, please try again later.',
    });
  },
});

/**
 * Token refresh — clients refresh on focus/visibility; 10/15min was too tight.
 */
export const tokenRefreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: REFRESH_RATE_MAX,
  message: {
    status: 'error',
    message: 'Too many token refresh attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      'Token refresh rate limit exceeded'
    );
    return void res.status(429).json({
      status: 'error',
      message: 'Too many token refresh attempts, please try again later.',
    });
  },
});

/**
 * Rate limiter for write operations (POST, PUT, DELETE)
 */
export const writeOperationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    status: 'error',
    message: 'Too many write operations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      'Write operation rate limit exceeded'
    );
    return void res.status(429).json({
      status: 'error',
      message: 'Too many write operations, please try again later.',
    });
  },
});

/**
 * Create custom rate limiter with specified options
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || {
      status: 'error',
      message: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        'Custom rate limit exceeded'
      );
      return void res.status(429).json({
        status: 'error',
        message: options.message || 'Too many requests, please try again later.',
      });
    },
  });
};
