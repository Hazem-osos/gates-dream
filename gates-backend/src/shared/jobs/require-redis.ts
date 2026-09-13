import { Response } from 'express';
import { env } from '../config/env';

/**
 * Wave 6 fix: `payrollQueue`/`reportsQueue` are BullMQ queues backed by a
 * lazily-connecting Redis client (see `workers/redis-connection.ts`) — on an
 * install with Redis disabled, calling `.add()`/`.getJob()` used to hang or
 * fail with a raw connection-timeout error instead of a clear "this feature
 * needs Redis" response. Call this at the top of any route that touches a
 * BullMQ queue and bail out with a 503 before ever attempting to connect.
 */
export function requireRedisEnabled(res: Response): boolean {
  if (!env.REDIS_ENABLED) {
    res.status(503).json({
      status: 'error',
      message: 'Background job processing is disabled on this server (REDIS_ENABLED=false)',
    });
    return false;
  }
  return true;
}
