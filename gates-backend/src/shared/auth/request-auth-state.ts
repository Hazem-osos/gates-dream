import { LRUCache } from 'lru-cache';
import { redisClient } from '../cache/redis';
import { logger } from '../logger';
import { createSession } from './session-manager';

/**
 * Per-request token checks for `authenticate`, done in as few Redis round trips
 * as possible. Same keys and the same outcomes as the older one-call-per-check
 * path (`isTokenBlacklisted`, `isAccountLocked`, `clearFailedAttempts`,
 * `updateSessionActivity`, `getSession`/`createSession`), which cost about
 * seven sequential Redis calls on every API request.
 *
 * - Reads (blacklist, lockout, session) go in one pipeline.
 * - Writes (clear failed attempts, session activity) happen at most once per
 *   token per TOUCH_INTERVAL_MS on this instance. A revoked token or a locked
 *   account is still refused on every request — only the bookkeeping is throttled.
 */

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // matches session-manager SESSION_TTL
export const TOUCH_INTERVAL_MS = 60_000;

const lastTouch = new LRUCache<string, true>({ max: 50_000, ttl: TOUCH_INTERVAL_MS });

export const authStateKeys = {
  blacklist: (tokenId: string) => `token_blacklist:${tokenId}`,
  lockout: (userId: string) => `account_locked:${userId}`,
  attempts: (userId: string) => `auth_attempts:${userId}`,
  session: (userId: string, tokenId: string) => `session:${userId}:${tokenId}`,
};

export type RequestAuthState =
  | { kind: 'ok' }
  | { kind: 'revoked' }
  | { kind: 'locked'; lockedUntil: number };

type SessionRecord = { lastActivityAt?: string } & Record<string, unknown>;

/** Test hook: forget which tokens were touched. */
export function resetAuthTouchCache(): void {
  lastTouch.clear();
}

export async function checkAndTouchRequestAuth(
  userId: string,
  tokenId: string,
  meta: { ipAddress: string; userAgent?: string }
): Promise<RequestAuthState> {
  if (!redisClient.isReady()) return { kind: 'ok' };

  const redis = redisClient.getClient();
  const sessionKey = authStateKeys.session(userId, tokenId);

  const results = await redis
    .pipeline()
    .exists(authStateKeys.blacklist(tokenId))
    .get(authStateKeys.lockout(userId))
    .get(sessionKey)
    .ttl(sessionKey)
    .exec();

  if (!results) return { kind: 'ok' };
  for (const [err] of results) {
    if (err) throw err;
  }

  const blacklisted = Number(results[0][1]) === 1;
  if (blacklisted) return { kind: 'revoked' };

  const lockRaw = results[1][1] as string | null;
  if (lockRaw) {
    const lock = JSON.parse(lockRaw) as { lockedUntil: number };
    if (lock.lockedUntil > Date.now()) {
      return { kind: 'locked', lockedUntil: lock.lockedUntil };
    }
    await redis.del(authStateKeys.lockout(userId));
  }

  const touchKey = `${userId}:${tokenId}`;
  if (lastTouch.has(touchKey)) return { kind: 'ok' };
  lastTouch.set(touchKey, true);

  const sessionRaw = results[2][1] as string | null;
  const sessionTtl = Number(results[3][1]);

  if (sessionRaw) {
    const session = JSON.parse(sessionRaw) as SessionRecord;
    session.lastActivityAt = new Date().toISOString();
    await redis
      .pipeline()
      .del(authStateKeys.attempts(userId))
      .setex(sessionKey, sessionTtl > 0 ? sessionTtl : SESSION_TTL_SECONDS, JSON.stringify(session))
      .exec();
  } else {
    await redis.del(authStateKeys.attempts(userId));
    await createSession(userId, tokenId, meta.ipAddress, meta.userAgent);
  }

  logger.debug({ userId }, 'Auth session touched');
  return { kind: 'ok' };
}
