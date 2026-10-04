import { redisClient } from './redis';

function generationKey(companyId: string) {
  return `cache:gen:${companyId}`;
}

/** Changes after every successful write so the next GET cannot reuse a pre-save list. */
export async function getHttpCacheGeneration(companyId: string): Promise<string> {
  if (!companyId || !redisClient.isReady()) return '0';
  try {
    const value = await redisClient.getClient().get(generationKey(companyId));
    return value || '0';
  } catch {
    return '0';
  }
}

export async function bumpHttpCacheGeneration(companyId: string): Promise<void> {
  if (!companyId || !redisClient.isReady()) return;
  try {
    await redisClient.getClient().incr(generationKey(companyId));
  } catch {
    // A failed bump leaves the previous generation. The next successful write retries.
  }
}
