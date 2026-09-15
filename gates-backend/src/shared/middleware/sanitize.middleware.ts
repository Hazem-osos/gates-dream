import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

/**
 * Input Sanitization Middleware
 * Sanitizes request body, query, and params to prevent XSS and injection attacks
 */

/**
 * Recursively sanitize strings in an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Remove potentially dangerous characters
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick=, onerror=, etc.)
      .trim();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Sanitize the key as well
        const sanitizedKey = sanitizeObject(key);
        sanitized[sanitizedKey] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitization middleware
 * Sanitizes request body, query, and params
 */
export const sanitize = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query) as any;
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params) as any;
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Error in sanitization middleware');
    next();
  }
};

/**
 * SQL injection prevention
 * Enhanced validation with better pattern detection and alerting
 * Note: Prisma provides parameterized queries, but this adds an extra layer of defense
 */
function isAiApiRequest(req: Request): boolean {
  const url = String(req.originalUrl || req.path || '').split('?')[0];
  return /\/api\/v1\/ai(?:\/|$)/.test(url);
}

function isDocumentLayoutApiRequest(req: Request): boolean {
  const url = String(req.originalUrl || req.path || '').split('?')[0];
  return /\/api\/v1\/document-layouts?(?:-configs)?(?:\/|$)/.test(url);
}

function shouldSkipInputGuard(req: Request): boolean {
  return isAiApiRequest(req) || isDocumentLayoutApiRequest(req);
}

export const preventSQLInjection = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (shouldSkipInputGuard(req)) return next();

  // Enhanced SQL injection patterns
  const sqlPatterns = [
    // SQL keywords in suspicious contexts
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|TRUNCATE|MERGE)\b)/gi,
    // SQL comment patterns (`#` alone matches hex colors like #0E78AA — do not flag it)
    /(--|\/\*|\*\/|;)/g,
    // Union-based injection
    /(UNION\s+(ALL\s+)?SELECT)/gi,
    // Boolean-based injection
    /(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/gi,
    // Time-based injection
    /(SLEEP|WAITFOR|DELAY)\s*\(/gi,
    // Function-based injection
    /(CONCAT|CHAR|ASCII|SUBSTRING|CAST|CONVERT)\s*\(/gi,
    // Information schema access
    /(INFORMATION_SCHEMA|sys\.|mysql\.)/gi,
  ];

  const checkValue = (value: any, path: string = ''): { found: boolean; pattern?: string; value?: string } => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          return { found: true, pattern: pattern.toString(), value };
        }
      }
    }
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const result = checkValue(value[i], `${path}[${i}]`);
          if (result.found) return result;
        }
      } else {
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            const result = checkValue(value[key], path ? `${path}.${key}` : key);
            if (result.found) return result;
          }
        }
      }
    }
    return { found: false };
  };

  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Check body
    if (req.body) {
      const result = checkValue(req.body, 'body');
      if (result.found) {
        logger.warn(
          {
            ip,
            path: req.path,
            method: req.method,
            pattern: result.pattern,
            suspiciousValue: result.value?.substring(0, 100), // Limit log size
            userAgent: req.headers['user-agent'],
          },
          'Potential SQL injection detected in request body'
        );
        
        // Alert security auditor
        // Note: Security audit middleware will handle this if configured
        
        return void res.status(400).json({
          status: 'error',
          message: 'Invalid input detected',
          code: 'SQL_INJECTION_DETECTED',
        });
      }
    }

    // Check query
    if (req.query) {
      const result = checkValue(req.query, 'query');
      if (result.found) {
        logger.warn(
          {
            ip,
            path: req.path,
            method: req.method,
            pattern: result.pattern,
            suspiciousValue: result.value?.substring(0, 100),
            userAgent: req.headers['user-agent'],
          },
          'Potential SQL injection detected in query parameters'
        );
        return void res.status(400).json({
          status: 'error',
          message: 'Invalid input detected',
          code: 'SQL_INJECTION_DETECTED',
        });
      }
    }

    // Check params
    if (req.params) {
      const result = checkValue(req.params, 'params');
      if (result.found) {
        logger.warn(
          {
            ip,
            path: req.path,
            method: req.method,
            pattern: result.pattern,
            suspiciousValue: result.value?.substring(0, 100),
            userAgent: req.headers['user-agent'],
          },
          'Potential SQL injection detected in route parameters'
        );
        return void res.status(400).json({
          status: 'error',
          message: 'Invalid input detected',
          code: 'SQL_INJECTION_DETECTED',
        });
      }
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Error in SQL injection prevention middleware');
    next();
  }
};

/**
 * XSS prevention
 * Checks for XSS patterns
 */
export const preventXSS = (req: Request, res: Response, next: NextFunction) => {
  if (shouldSkipInputGuard(req)) return next();

  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return xssPatterns.some((pattern) => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some((val) => checkValue(val));
    }
    return false;
  };

  try {
    // Check body
    if (req.body && checkValue(req.body)) {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
        },
        'Potential XSS detected in request body'
      );
      return void res.status(400).json({
        status: 'error',
        message: 'Invalid input detected',
      });
    }

    // Check query
    if (req.query && checkValue(req.query)) {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
        },
        'Potential XSS detected in query parameters'
      );
      return void res.status(400).json({
        status: 'error',
        message: 'Invalid input detected',
      });
    }

    // Check params
    if (req.params && checkValue(req.params)) {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
        },
        'Potential XSS detected in route parameters'
      );
      return void res.status(400).json({
        status: 'error',
        message: 'Invalid input detected',
      });
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Error in XSS prevention middleware');
    next();
  }
};

