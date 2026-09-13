import { workerRedisConnection } from '../../../workers/redis-connection';
import { logger } from '../../../shared/logger';

const TTL_SECONDS = 36 * 60 * 60;

export async function claimIdempotencyKey(key: string, ttlSeconds = TTL_SECONDS): Promise<boolean> {
  try {
    const result = await workerRedisConnection.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.warn({ error, key }, 'Idempotency claim failed — proceeding without lock');
    return true;
  }
}

export function lateFeeIdempotencyKey(companyId: string, dateKey: string): string {
  return `automation:idempotency:daily-late-fee:${companyId}:${dateKey}`;
}

export function chequeMaturityIdempotencyKey(companyId: string, dateKey: string): string {
  return `automation:idempotency:cheque-maturity:${companyId}:${dateKey}`;
}

export function dynamicPricingIdempotencyKey(companyId: string, weekKey: string): string {
  return `automation:idempotency:dynamic-pricing:${companyId}:${weekKey}`;
}
