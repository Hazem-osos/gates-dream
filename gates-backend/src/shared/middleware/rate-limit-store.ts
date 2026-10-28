import { MemoryStore, type Options, type Store, type ClientRateLimitInfo } from 'express-rate-limit';
import { redisClient } from '../cache/redis';
import { logger } from '../logger';

/**
 * express-rate-limit store shared by every API process (cluster workers today,
 * Railway replicas later). The default MemoryStore counts per process, so with
 * N processes every limit was effectively N times looser — including the login
 * brute-force limit.
 *
 * One atomic Lua call per hit (INCR + PEXPIRE on first hit + PTTL). When Redis is
 * not ready it falls back to the old per-process MemoryStore, so a Redis outage
 * degrades to the previous behaviour instead of blocking or opening the API.
 */
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return { hits, ttl }
`;

let errorLoggedAt = 0;
function logRedisFailure(err: unknown, prefix: string): void {
  const now = Date.now();
  if (now - errorLoggedAt < 60_000) return;
  errorLoggedAt = now;
  logger.warn({ err, prefix }, 'Rate-limit Redis store failed — using per-process fallback');
}

export class SharedRateLimitStore implements Store {
  readonly prefix: string;
  /** Counters live outside this process. */
  readonly localKeys = false;
  private windowMs = 60_000;
  private readonly fallback = new MemoryStore();

  constructor(prefix: string) {
    this.prefix = `rl:${prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  private redisReady(): boolean {
    return redisClient.isReady();
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (this.redisReady()) {
      try {
        const [hits, ttl] = (await redisClient
          .getClient()
          .eval(INCREMENT_SCRIPT, 1, this.prefix + key, String(this.windowMs))) as [number, number];
        return { totalHits: Number(hits), resetTime: new Date(Date.now() + Number(ttl)) };
      } catch (err) {
        logRedisFailure(err, this.prefix);
      }
    }
    return this.fallback.increment(key);
  }

  async decrement(key: string): Promise<void> {
    if (this.redisReady()) {
      try {
        await redisClient.getClient().decr(this.prefix + key);
        return;
      } catch (err) {
        logRedisFailure(err, this.prefix);
      }
    }
    await this.fallback.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    if (this.redisReady()) {
      try {
        await redisClient.getClient().del(this.prefix + key);
      } catch (err) {
        logRedisFailure(err, this.prefix);
      }
    }
    await this.fallback.resetKey(key);
  }
}
