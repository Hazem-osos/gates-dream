import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../logger';
import { recordViolation } from './ip-blocking.middleware';

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP address
 */

/**
 * General API rate limiter
 * Production: 100 requests / 15 min per IP. Development: relaxed for local ERP + Command Palette.
 */
const API_RATE_WINDOW_MS = 15 * 60 * 1000;
const API_RATE_MAX =
  Number.parseInt(process.env.API_RATE_LIMIT_MAX ?? '', 10) ||
  (process.env.NODE_ENV === 'production' ? 100 : 5000);

export const apiRateLimiter = rateLimit({
  windowMs: API_RATE_WINDOW_MS,
  max: API_RATE_MAX,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: async (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Record violation for IP blocking
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
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 authentication requests per windowMs
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: async (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Record violation for IP blocking
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
 * Strict rate limiter for token refresh
 * 10 requests per 15 minutes per IP
 */
export const tokenRefreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 token refresh requests per windowMs
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
 * 50 requests per 15 minutes per IP
 */
export const writeOperationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 write operations per windowMs
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

