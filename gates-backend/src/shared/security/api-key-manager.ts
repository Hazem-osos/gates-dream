import { createHash } from 'node:crypto';
import { prisma } from '../database/prisma';
import { logger } from '../logger';
import { generateAPIKey, encrypt, decrypt } from './secrets-manager';
import { redisClient } from '../cache/redis';

/**
 * API Key Management Service
 * Manages API keys for external integrations and service-to-service communication
 */

export interface APIKey {
  id: string;
  name: string;
  key: string; // Encrypted
  keyHash: string; // Hashed for lookup
  userId?: string;
  tenantId?: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAPIKeyInput {
  name: string;
  userId?: string;
  tenantId?: string;
  permissions: string[];
  expiresInDays?: number;
}

/**
 * Hash API key for lookup (one-way hash)
 */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Create API key
 */
export async function createAPIKey(input: CreateAPIKeyInput): Promise<{ key: string; apiKey: APIKey }> {
  // Generate API key
  const plainKey = generateAPIKey();
  const keyHash = hashKey(plainKey);

  // Encrypt key for storage
  const encryptedKey = encrypt(plainKey);

  // Calculate expiration
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  // Store in database
  let apiKeyRecord;
  try {
    apiKeyRecord = await prisma.apiKey.create({
      data: {
        name: input.name,
        key: encryptedKey,
        keyHash,
        userId: input.userId || null,
        companyId: input.tenantId || null, // Using tenantId as companyId
        tenantId: input.tenantId || null,
        permissions: input.permissions,
        expiresAt: expiresAt || null,
        lastUsedAt: null,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to store API key in database');
    throw error;
  }

  // Also store in Redis (for quick lookup)
  if (redisClient.isReady()) {
    try {
      const redis = redisClient.getClient();
      const cacheData = {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        keyHash: apiKeyRecord.keyHash,
        userId: apiKeyRecord.userId,
        tenantId: apiKeyRecord.tenantId,
        permissions: apiKeyRecord.permissions,
        expiresAt: apiKeyRecord.expiresAt,
        createdAt: apiKeyRecord.createdAt,
        updatedAt: apiKeyRecord.updatedAt,
      };
      await redis.setex(
        `api_key:${keyHash}`,
        expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 1000) : 86400 * 365, // 1 year default
        JSON.stringify(cacheData)
      );
    } catch (error) {
      logger.error({ error }, 'Failed to store API key in Redis');
    }
  }

  logger.info(
    {
      keyId: apiKeyRecord.id,
      name: input.name,
      userId: input.userId,
      tenantId: input.tenantId,
    },
    'API key created'
  );

  return {
    key: plainKey, // Return plain key only once
    apiKey: {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      key: '***ENCRYPTED***',
      keyHash: apiKeyRecord.keyHash,
      userId: apiKeyRecord.userId || undefined,
      tenantId: apiKeyRecord.tenantId || undefined,
      permissions: apiKeyRecord.permissions as string[],
      expiresAt: apiKeyRecord.expiresAt || undefined,
      lastUsedAt: apiKeyRecord.lastUsedAt || undefined,
      createdAt: apiKeyRecord.createdAt,
      updatedAt: apiKeyRecord.updatedAt,
    } as APIKey,
  };
}

/**
 * Verify API key
 */
export async function verifyAPIKey(key: string): Promise<APIKey | null> {
  const keyHash = hashKey(key);

  // Check Redis first
  if (redisClient.isReady()) {
    try {
      const redis = redisClient.getClient();
      const cached = await redis.get(`api_key:${keyHash}`);

      if (cached) {
        const apiKey = JSON.parse(cached) as APIKey;

        // Check expiration
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
          logger.warn({ keyHash }, 'API key expired');
          return null;
        }

        // Update last used
        apiKey.lastUsedAt = new Date();
        await redis.setex(
          `api_key:${keyHash}`,
          apiKey.expiresAt
            ? Math.floor((new Date(apiKey.expiresAt).getTime() - Date.now()) / 1000)
            : 86400 * 365,
          JSON.stringify(apiKey)
        );

        return apiKey;
      }
    } catch (error) {
      logger.error({ error }, 'Failed to verify API key from Redis');
    }
  }

  // Fallback to database lookup
  try {
    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
    if (apiKey) {
      // Check expiration
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        logger.warn({ keyHash }, 'API key expired');
        return null;
      }

      // Update last used
      await prisma.apiKey.update({
        where: { keyHash },
        data: { lastUsedAt: new Date() },
      });

      return {
        id: apiKey.id,
        name: apiKey.name,
        key: '***ENCRYPTED***',
        keyHash: apiKey.keyHash,
        userId: apiKey.userId || undefined,
        tenantId: apiKey.tenantId || undefined,
        permissions: apiKey.permissions as string[],
        expiresAt: apiKey.expiresAt || undefined,
        lastUsedAt: apiKey.lastUsedAt || undefined,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
      } as APIKey;
    }
  } catch (error) {
    logger.error({ error }, 'Failed to lookup API key in database');
  }

  return null;
}

/**
 * Revoke API key
 */
export async function revokeAPIKey(keyHash: string): Promise<void> {
  // Remove from Redis
  if (redisClient.isReady()) {
    try {
      const redis = redisClient.getClient();
      await redis.del(`api_key:${keyHash}`);
    } catch (error) {
      logger.error({ error }, 'Failed to revoke API key from Redis');
    }
  }

  // Remove from database
  try {
    await prisma.apiKey.delete({ where: { keyHash } });
  } catch (error) {
    logger.error({ error }, 'Failed to delete API key from database');
  }

  logger.info({ keyHash }, 'API key revoked');
}

/**
 * List API keys for a user/tenant
 */
export async function listAPIKeys(
  userId?: string,
  tenantId?: string
): Promise<APIKey[]> {
  try {
    const where: any = {};
    if (userId) where.userId = userId;
    if (tenantId) where.tenantId = tenantId;

    const apiKeys = await prisma.apiKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      key: '***ENCRYPTED***',
      keyHash: key.keyHash,
      userId: key.userId || undefined,
      tenantId: key.tenantId || undefined,
      permissions: key.permissions as string[],
      expiresAt: key.expiresAt || undefined,
      lastUsedAt: key.lastUsedAt || undefined,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to list API keys');
    return [];
  }
}

/**
 * Rotate API key (create new, revoke old)
 */
export async function rotateAPIKey(
  oldKeyHash: string,
  input: CreateAPIKeyInput
): Promise<{ key: string; apiKey: APIKey }> {
  // Revoke old key
  await revokeAPIKey(oldKeyHash);

  // Create new key
  return createAPIKey(input);
}

/**
 * Check if API key has permission
 */
export function hasPermission(apiKey: APIKey, permission: string): boolean {
  return apiKey.permissions.includes(permission) || apiKey.permissions.includes('*');
}

/**
 * Resolve the `tenantId` a newly created API key should be scoped to.
 *
 * SECURITY: an API key's `tenantId` is the sole scoping check
 * `apiKeyMayLookupCompany` relies on for `/internal/v1/automation/*` — a
 * key minted here can read/act on that tenant's automation rules and
 * purchase-request automation. It must always come from the authenticated
 * session, never from attacker-controlled request-body input. A caller
 * whose own session has no resolvable company also cannot create a key
 * (there is nothing safe to scope it to).
 *
 * Returns the tenantId to use, or an explicit mismatch error the route
 * should surface as 403 rather than silently overriding the body value —
 * a caller that sent a foreign tenantId must never be led to believe it
 * was honored.
 */
export function resolveApiKeyTenantId(
  sessionCompanyId: string | undefined,
  requestedTenantId: string | undefined
): { tenantId: string } | { error: 'no_session_company' | 'tenant_mismatch' } {
  if (!sessionCompanyId) {
    return { error: 'no_session_company' };
  }
  if (requestedTenantId && requestedTenantId !== sessionCompanyId) {
    return { error: 'tenant_mismatch' };
  }
  return { tenantId: sessionCompanyId };
}

