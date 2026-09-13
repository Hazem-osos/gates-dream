import { invalidateCache } from './cache.middleware';
import { logger } from '../logger';

/**
 * Centralized Cache Manager
 * Provides smart cache invalidation based on entity relationships
 */
export class CacheManager {
  /**
   * Invalidate cache for a specific entity
   */
  async invalidateEntity(entityType: string, entityId: string): Promise<void> {
    const patterns = [
      `*${entityType}*`,
      `*${entityId}*`,
    ];
    
    for (const pattern of patterns) {
      await invalidateCache(pattern);
    }
    
    logger.debug({ entityType, entityId }, 'Cache invalidated for entity');
  }

  /**
   * Invalidate cache for company (affects all company data)
   */
  async invalidateCompany(companyId: string): Promise<void> {
    await invalidateCache(`*company:${companyId}*`);
    logger.debug({ companyId }, 'Cache invalidated for company');
  }

  /**
   * Invalidate cache for related entities when parent changes
   */
  async invalidateRelated(
    entityType: string,
    relatedTypes: string[]
  ): Promise<void> {
    for (const relatedType of relatedTypes) {
      await invalidateCache(`*${relatedType}*`);
    }
    await invalidateCache(`*${entityType}*`);
    logger.debug({ entityType, relatedTypes }, 'Cache invalidated for related entities');
  }

  /**
   * Invalidate all cache (use with caution)
   */
  async invalidateAll(): Promise<void> {
    await invalidateCache('');
    logger.warn('All cache invalidated');
  }
}

export const cacheManager = new CacheManager();

