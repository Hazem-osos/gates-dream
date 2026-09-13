import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import { env } from '../config/env';

/**
 * Security Headers Validation Middleware
 * Validates that security headers are properly set in production
 */

const REQUIRED_SECURITY_HEADERS = [
  'x-content-type-options',
  'x-frame-options',
  'x-xss-protection',
  'strict-transport-security', // HSTS
  'content-security-policy',
];

/**
 * Security headers validation middleware
 */
export const securityHeadersValidation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Only validate in production
  if (env.NODE_ENV !== 'production') {
    return next();
  }

  // Check response headers after they're set
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function (name: string, value: string | number | string[]) {
    originalSetHeader(name, value);
    return this;
  };

  // Validate headers on response finish
  res.on('finish', () => {
    const missingHeaders: string[] = [];

    for (const header of REQUIRED_SECURITY_HEADERS) {
      if (!res.getHeader(header)) {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      logger.error(
        {
          path: req.path,
          method: req.method,
          missingHeaders,
        },
        'Security headers missing in production response'
      );

      // In production, this is a critical issue
      // Consider alerting monitoring system
    }
  });

  next();
};

