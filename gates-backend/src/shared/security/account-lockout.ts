import { prisma } from '../database/prisma';
import { logger } from '../logger';
import { redisClient } from '../cache/redis';

/**
 * Account Lockout Service
 * Locks accounts after repeated failed authentication attempts
 */

interface LockoutInfo {
  userId: string;
  lockedUntil: number;
  attemptCount: number;
  lockoutLevel: number; // 1=15min, 2=1hr, 3=24hr
}

const MAX_ATTEMPTS = 5; // Lock after 5 failed attempts
const LOCKOUT_DURATIONS = [
  15 * 60 * 1000, // 15 minutes (level 1)
  60 * 60 * 1000, // 1 hour (level 2)
  24 * 60 * 60 * 1000, // 24 hours (level 3)
];
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes window

/**
 * Get attempt key for Redis
 */
function getAttemptKey(userId: string): string {
  return `auth_attempts:${userId}`;
}

/**
 * Get lockout key for Redis
 */
function getLockoutKey(userId: string): string {
  return `account_locked:${userId}`;
}

/**
 * Record a failed authentication attempt
 */
export async function recordFailedAttempt(userId: string): Promise<void> {
  if (!redisClient.isReady()) {
    // Fallback to database if Redis unavailable
    await recordFailedAttemptDB(userId);
    return;
  }

  try {
    const key = getAttemptKey(userId);
    const redis = redisClient.getClient();

    // Increment attempt count
    const count = await redis.incr(key);
    await redis.expire(key, Math.ceil(ATTEMPT_WINDOW / 1000));

    // Determine lockout level based on attempt count
    let lockoutLevel = 0;
    if (count >= MAX_ATTEMPTS * 3) {
      lockoutLevel = 3; // 24 hours
    } else if (count >= MAX_ATTEMPTS * 2) {
      lockoutLevel = 2; // 1 hour
    } else if (count >= MAX_ATTEMPTS) {
      lockoutLevel = 1; // 15 minutes
    }

    // Lock account if threshold exceeded
    if (lockoutLevel > 0) {
      const lockoutDuration = LOCKOUT_DURATIONS[lockoutLevel - 1];
      const lockedUntil = Date.now() + lockoutDuration;

      await redis.setex(
        getLockoutKey(userId),
        Math.ceil(lockoutDuration / 1000),
        JSON.stringify({
          userId,
          lockedUntil,
          attemptCount: count,
          lockoutLevel,
        })
      );

      logger.warn(
        {
          userId,
          attemptCount: count,
          lockoutLevel,
          lockoutDuration: lockoutDuration / 1000 / 60, // minutes
          lockedUntil: new Date(lockedUntil).toISOString(),
        },
        'Account locked due to repeated failed authentication attempts'
      );

      // Reset attempt count
      await redis.del(key);
    }
  } catch (error) {
    logger.error({ error, userId }, 'Error recording failed authentication attempt');
    // Fallback to database
    await recordFailedAttemptDB(userId);
  }
}

/**
 * Record failed attempt in database (fallback)
 */
async function recordFailedAttemptDB(userId: string): Promise<void> {
  try {
    // Store in activity log
    await prisma.activityLog.create({
      data: {
        tenantId: 'system', // System-level log
        actorId: userId,
        kind: 'security',
        subjectType: 'user',
        subjectId: userId,
        severity: 'warning',
        reason: 'Failed authentication attempt',
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error({ error, userId }, 'Error recording failed attempt in database');
  }
}

/**
 * Clear failed attempts (call on successful authentication)
 */
export async function clearFailedAttempts(userId: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    await redis.del(getAttemptKey(userId));
  } catch (error) {
    logger.error({ error, userId }, 'Error clearing failed attempts');
  }
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(userId: string): Promise<LockoutInfo | null> {
  if (!redisClient.isReady()) {
    return null; // If Redis unavailable, don't block (fail open)
  }

  try {
    const redis = redisClient.getClient();
    const locked = await redis.get(getLockoutKey(userId));

    if (locked) {
      const lockoutInfo: LockoutInfo = JSON.parse(locked);
      if (lockoutInfo.lockedUntil > Date.now()) {
        return lockoutInfo;
      } else {
        // Lock expired, remove it
        await redis.del(getLockoutKey(userId));
        return null;
      }
    }

    return null;
  } catch (error) {
    logger.error({ error, userId }, 'Error checking account lock status');
    return null; // Fail open
  }
}

/**
 * Clear account lock (admin function)
 */
export async function clearAccountLock(userId: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    await redis.del(getLockoutKey(userId));
    await redis.del(getAttemptKey(userId));

    logger.info({ userId }, 'Account lock cleared');
  } catch (error) {
    logger.error({ error, userId }, 'Error clearing account lock');
  }
}

/**
 * Get remaining attempts before lockout
 */
export async function getRemainingAttempts(userId: string): Promise<number> {
  if (!redisClient.isReady()) {
    return MAX_ATTEMPTS; // If Redis unavailable, return max
  }

  try {
    const redis = redisClient.getClient();
    const count = await redis.get(getAttemptKey(userId));
    const attemptCount = count ? parseInt(count, 10) : 0;
    return Math.max(0, MAX_ATTEMPTS - attemptCount);
  } catch (error) {
    logger.error({ error, userId }, 'Error getting remaining attempts');
    return MAX_ATTEMPTS;
  }
}

