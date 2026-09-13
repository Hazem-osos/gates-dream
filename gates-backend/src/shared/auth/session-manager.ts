import { redisClient } from '../cache/redis';
import { logger } from '../logger';
import { prisma } from '../database/prisma';

/**
 * Session Management Service
 * Manages user sessions, token blacklisting, and concurrent session limits
 */

export interface SessionInfo {
  userId: string;
  tokenId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

const SESSION_TTL = 24 * 60 * 60; // 24 hours
const MAX_CONCURRENT_SESSIONS = 5; // Maximum concurrent sessions per user

/**
 * Store session information
 */
export async function createSession(
  userId: string,
  tokenId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL * 1000);

    const sessionInfo: SessionInfo = {
      userId,
      tokenId,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
    };

    // Store session
    await redis.setex(
      `session:${userId}:${tokenId}`,
      SESSION_TTL,
      JSON.stringify(sessionInfo)
    );

    // Add to user's session list
    await redis.sadd(`user_sessions:${userId}`, tokenId);
    await redis.expire(`user_sessions:${userId}`, SESSION_TTL);

    logger.debug({ userId, tokenId }, 'Session created');
  } catch (error) {
    logger.error({ error, userId, tokenId }, 'Failed to create session');
  }
}

/**
 * Update session activity
 */
export async function updateSessionActivity(
  userId: string,
  tokenId: string
): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    const sessionKey = `session:${userId}:${tokenId}`;
    const cached = await redis.get(sessionKey);

    if (cached) {
      const session: SessionInfo = JSON.parse(cached);
      session.lastActivityAt = new Date();

      const ttl = await redis.ttl(sessionKey);
      await redis.setex(sessionKey, ttl > 0 ? ttl : SESSION_TTL, JSON.stringify(session));
    }
  } catch (error) {
    logger.error({ error, userId, tokenId }, 'Failed to update session activity');
  }
}

/**
 * Get session information
 */
export async function getSession(
  userId: string,
  tokenId: string
): Promise<SessionInfo | null> {
  if (!redisClient.isReady()) {
    return null;
  }

  try {
    const redis = redisClient.getClient();
    const cached = await redis.get(`session:${userId}:${tokenId}`);

    if (cached) {
      return JSON.parse(cached) as SessionInfo;
    }
  } catch (error) {
    logger.error({ error, userId, tokenId }, 'Failed to get session');
  }

  return null;
}

/**
 * Revoke session (logout)
 */
export async function revokeSession(userId: string, tokenId: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();

    // Remove session
    await redis.del(`session:${userId}:${tokenId}`);

    // Remove from user's session list
    await redis.srem(`user_sessions:${userId}`, tokenId);

    // Add to blacklist
    await redis.setex(`token_blacklist:${tokenId}`, SESSION_TTL, '1');

    logger.info({ userId, tokenId }, 'Session revoked');
  } catch (error) {
    logger.error({ error, userId, tokenId }, 'Failed to revoke session');
  }
}

/**
 * Revoke all user sessions
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    const sessionIds = await redis.smembers(`user_sessions:${userId}`);

    for (const tokenId of sessionIds) {
      await redis.del(`session:${userId}:${tokenId}`);
      await redis.setex(`token_blacklist:${tokenId}`, SESSION_TTL, '1');
    }

    await redis.del(`user_sessions:${userId}`);

    logger.info({ userId, count: sessionIds.length }, 'All user sessions revoked');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to revoke all user sessions');
  }
}

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(tokenId: string): Promise<boolean> {
  if (!redisClient.isReady()) {
    return false;
  }

  try {
    const redis = redisClient.getClient();
    const exists = await redis.exists(`token_blacklist:${tokenId}`);
    return exists === 1;
  } catch (error) {
    logger.error({ error, tokenId }, 'Failed to check token blacklist');
    return false;
  }
}

/**
 * Enforce concurrent session limit
 */
export async function enforceSessionLimit(userId: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    const sessionIds = await redis.smembers(`user_sessions:${userId}`);

    if (sessionIds.length >= MAX_CONCURRENT_SESSIONS) {
      // Remove oldest sessions (keep most recent)
      const sessions = await Promise.all(
        sessionIds.map(async (tokenId) => {
          const cached = await redis.get(`session:${userId}:${tokenId}`);
          if (cached) {
            const session: SessionInfo = JSON.parse(cached);
            return { tokenId, lastActivityAt: session.lastActivityAt.getTime() };
          }
          return { tokenId, lastActivityAt: 0 };
        })
      );

      // Sort by last activity (oldest first)
      sessions.sort((a, b) => a.lastActivityAt - b.lastActivityAt);

      // Remove oldest sessions
      const toRemove = sessions.slice(0, sessionIds.length - MAX_CONCURRENT_SESSIONS + 1);
      for (const session of toRemove) {
        await revokeSession(userId, session.tokenId);
      }

      logger.info(
        {
          userId,
          removed: toRemove.length,
          remaining: MAX_CONCURRENT_SESSIONS - 1,
        },
        'Session limit enforced'
      );
    }
  } catch (error) {
    logger.error({ error, userId }, 'Failed to enforce session limit');
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  if (!redisClient.isReady()) {
    return [];
  }

  try {
    const redis = redisClient.getClient();
    const sessionIds = await redis.smembers(`user_sessions:${userId}`);
    const sessions: SessionInfo[] = [];

    for (const tokenId of sessionIds) {
      const cached = await redis.get(`session:${userId}:${tokenId}`);
      if (cached) {
        sessions.push(JSON.parse(cached) as SessionInfo);
      }
    }

    return sessions.sort(
      (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get user sessions');
    return [];
  }
}

