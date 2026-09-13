import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../cache/redis';
import { logger } from '../logger';
import { env } from '../config/env';

/**
 * IP Blocking Middleware
 * Blocks IPs after repeated rate limit violations
 */

interface BlockedIP {
  ip: string;
  blockedUntil: number;
  violationCount: number;
}

const BLOCK_DURATION_BASE = 15 * 60 * 1000; // 15 minutes base
const MAX_VIOLATIONS = 5; // Block after 5 violations
const VIOLATION_WINDOW = 60 * 60 * 1000; // 1 hour window

/**
 * Get violation key for Redis
 */
function getViolationKey(ip: string): string {
  return `ip_violations:${ip}`;
}

/**
 * Get block key for Redis
 */
function getBlockKey(ip: string): string {
  return `ip_blocked:${ip}`;
}

/**
 * Record a rate limit violation
 */
export async function recordViolation(ip: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const key = getViolationKey(ip);
    const redis = redisClient.getClient();

    // Increment violation count
    const count = await redis.incr(key);
    await redis.expire(key, Math.ceil(VIOLATION_WINDOW / 1000));

    // If violations exceed threshold, block the IP
    if (count >= MAX_VIOLATIONS) {
      const blockDuration = BLOCK_DURATION_BASE * Math.min(count - MAX_VIOLATIONS + 1, 4); // Progressive: 15min, 30min, 45min, 60min
      const blockedUntil = Date.now() + blockDuration;

      await redis.setex(
        getBlockKey(ip),
        Math.ceil(blockDuration / 1000),
        JSON.stringify({
          ip,
          blockedUntil,
          violationCount: count,
        })
      );

      logger.warn(
        {
          ip,
          violationCount: count,
          blockDuration: blockDuration / 1000 / 60, // minutes
          blockedUntil: new Date(blockedUntil).toISOString(),
        },
        'IP blocked due to repeated rate limit violations'
      );

      // Reset violation count
      await redis.del(key);
    }
  } catch (error) {
    logger.error({ error, ip }, 'Error recording IP violation');
  }
}

/**
 * Check if IP is blocked
 */
export async function isIPBlocked(ip: string): Promise<boolean> {
  if (!redisClient.isReady()) {
    return false;
  }

  try {
    const redis = redisClient.getClient();
    const blocked = await redis.get(getBlockKey(ip));

    if (blocked) {
      const blockInfo: BlockedIP = JSON.parse(blocked);
      if (blockInfo.blockedUntil > Date.now()) {
        return true;
      } else {
        // Block expired, remove it
        await redis.del(getBlockKey(ip));
        return false;
      }
    }

    return false;
  } catch (error) {
    logger.error({ error, ip }, 'Error checking IP block status');
    return false;
  }
}

/**
 * IP blocking middleware
 */
export const ipBlockingMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // Skip blocking for localhost in development (incl. IPv4-mapped ::ffff:127.0.0.1)
  const isLocalhost =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost';
  if (env.NODE_ENV === 'development' && isLocalhost) {
    return next();
  }

  const blocked = await isIPBlocked(ip);

  if (blocked) {
    logger.warn(
      {
        ip,
        path: req.path,
        method: req.method,
      },
      'Blocked IP attempted to access API'
    );

    return void res.status(403).json({
      status: 'error',
      message: 'IP address has been temporarily blocked due to repeated violations',
      code: 'IP_BLOCKED',
    });
    return;
  }

  next();
};

/**
 * Clear IP block (admin function)
 */
export async function clearIPBlock(ip: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    await redis.del(getBlockKey(ip));
    await redis.del(getViolationKey(ip));

    logger.info({ ip }, 'IP block cleared');
  } catch (error) {
    logger.error({ error, ip }, 'Error clearing IP block');
  }
}

