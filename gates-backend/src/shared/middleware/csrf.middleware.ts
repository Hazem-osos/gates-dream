import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import { redisClient } from '../cache/redis';
import * as crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * Implements Double-Submit Cookie pattern for CSRF protection
 * Since we use JWT tokens, CSRF risk is lower but still important for state-changing operations
 */

const CSRF_TOKEN_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_TOKEN_TTL = 3600; // 1 hour

/**
 * Generate CSRF token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store CSRF token in Redis (for distributed systems)
 */
async function storeToken(token: string, userId: string): Promise<void> {
  if (redisClient.isReady()) {
    try {
      const redis = redisClient.getClient();
      await redis.setex(`csrf:${userId}:${token}`, CSRF_TOKEN_TTL, '1');
    } catch (error) {
      logger.error({ error }, 'Failed to store CSRF token in Redis');
    }
  }
}

/**
 * Verify CSRF token
 */
async function verifyToken(token: string, userId: string): Promise<boolean> {
  if (!redisClient.isReady()) {
    // No shared store — rely on double-submit cookie match only (local dev).
    return true;
  }
  try {
    const redis = redisClient.getClient();
    const exists = await redis.exists(`csrf:${userId}:${token}`);
    return exists === 1;
  } catch (error) {
    logger.error({ error }, 'Failed to verify CSRF token');
    return true;
  }
}

/**
 * Check if request should be exempt from CSRF protection
 */
function shouldExempt(req: Request): boolean {
  // Exempt GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true;
  }

  // Exempt health check endpoints
  if (req.path.startsWith('/health')) {
    return true;
  }

  // Exempt metrics endpoint
  if (req.path === '/metrics') {
    return true;
  }

  // Exempt GraphQL (handled separately if needed)
  if (req.path === '/api/graphql') {
    return false; // GraphQL mutations need CSRF protection
  }

  return false;
}

/**
 * CSRF Protection Middleware
 * Validates CSRF token for state-changing operations
 */
export const csrfProtection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip CSRF check for exempt requests
    if (shouldExempt(req)) {
      return next();
    }

    // Get user ID from request (set by auth middleware)
    const userId = (req as any).user?.sub;
    if (!userId) {
      // If no user, CSRF protection not needed (will be caught by auth middleware)
      return next();
    }

    // Get token from header
    const tokenFromHeader = req.headers[CSRF_TOKEN_HEADER.toLowerCase()] as string;
    
    // Get token from cookie (Double-Submit Cookie pattern)
    const tokenFromCookie = req.cookies?.[CSRF_COOKIE_NAME];

    // Verify tokens match (Double-Submit Cookie pattern)
    if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userId,
          hasHeaderToken: !!tokenFromHeader,
          hasCookieToken: !!tokenFromCookie,
        },
        'CSRF token validation failed'
      );

      return void res.status(403).json({
        status: 'error',
        message: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID',
      });
    }

    // Verify token exists in Redis (for distributed systems)
    const isValid = await verifyToken(tokenFromHeader, userId);
    if (!isValid) {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userId,
        },
        'CSRF token not found or expired'
      );

      return void res.status(403).json({
        status: 'error',
        message: 'CSRF token expired or invalid',
        code: 'CSRF_TOKEN_EXPIRED',
      });
    }

    next();
  } catch (error) {
    logger.error({ error }, 'CSRF protection middleware error');
    // Fail open in case of errors (don't block legitimate requests)
    next();
  }
};

/**
 * Generate and set CSRF token (call this on login or token refresh)
 */
export const generateCSRFToken = async (
  req: Request,
  res: Response,
  userId: string
): Promise<string> => {
  const token = generateToken();
  
  // Store token in Redis
  await storeToken(token, userId);

  // Set cookie (httpOnly: false so JavaScript can read it)
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript for Double-Submit Cookie pattern
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_TTL * 1000,
    path: '/',
  });

  return token;
};

/**
 * Middleware to attach CSRF token to response (for GET requests)
 * Frontend can read token from cookie and send in header
 */
export const attachCSRFToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) {
      return next();
    }

    // Check if token already exists in cookie
    const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (existingToken) {
      // Verify token is still valid
      const isValid = await verifyToken(existingToken, userId);
      if (isValid) {
        // Token is valid, attach to response header for convenience
        res.setHeader(CSRF_TOKEN_HEADER, existingToken);
        return next();
      }
    }

    // Generate new token
    const token = await generateCSRFToken(req, res, userId);
    res.setHeader(CSRF_TOKEN_HEADER, token);

    next();
  } catch (error) {
    logger.error({ error }, 'Error attaching CSRF token');
    next();
  }
};

