import * as crypto from 'crypto';
import { logger } from '../logger';
import { redisClient } from '../cache/redis';

/**
 * Secrets Management Service
 * Manages encryption/decryption of sensitive data and API keys
 * For production, integrate with AWS Secrets Manager, HashiCorp Vault, or Kubernetes Secrets
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Get encryption key from environment or generate one
 * In production, this should come from a secrets management service
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    logger.warn('ENCRYPTION_KEY not set, using default (NOT SECURE FOR PRODUCTION)');
    // Generate a deterministic key from a default (NOT SECURE - for development only)
    return crypto.scryptSync('default-key-change-in-production', 'salt', 32);
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt sensitive data
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine IV, tag, and encrypted data
    const result = {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      encrypted,
    };

    return Buffer.from(JSON.stringify(result)).toString('base64');
  } catch (error) {
    logger.error({ error }, 'Encryption failed');
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const data = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));

    const iv = Buffer.from(data.iv, 'hex');
    const tag = Buffer.from(data.tag, 'hex');
    const encrypted = data.encrypted;

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error({ error }, 'Decryption failed');
    throw new Error('Decryption failed');
  }
}

/**
 * Hash a value (one-way, for passwords)
 */
export function hash(value: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto
    .pbkdf2Sync(value, generatedSalt, 10000, 64, 'sha512')
    .toString('hex');
  return { hash, salt: generatedSalt };
}

/**
 * Verify a hash
 */
export function verifyHash(value: string, hashValue: string, salt: string): boolean {
  const computedHash = crypto
    .pbkdf2Sync(value, salt, 10000, 64, 'sha512')
    .toString('hex');
  return computedHash === hashValue;
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate API key
 */
export function generateAPIKey(prefix: string = 'gates'): string {
  const randomPart = generateSecureToken(16);
  return `${prefix}_${randomPart}`;
}

/**
 * Store encrypted secret in Redis (for temporary storage)
 * For persistent storage, use database with encrypted fields
 */
export async function storeSecret(
  key: string,
  value: string,
  ttl?: number
): Promise<void> {
  if (!redisClient.isReady()) {
    throw new Error('Redis not available for secret storage');
  }

  try {
    const encrypted = encrypt(value);
    const redis = redisClient.getClient();

    if (ttl) {
      await redis.setex(`secret:${key}`, ttl, encrypted);
    } else {
      await redis.set(`secret:${key}`, encrypted);
    }

    logger.debug({ key }, 'Secret stored');
  } catch (error) {
    logger.error({ error, key }, 'Failed to store secret');
    throw error;
  }
}

/**
 * Retrieve encrypted secret from Redis
 */
export async function getSecret(key: string): Promise<string | null> {
  if (!redisClient.isReady()) {
    return null;
  }

  try {
    const redis = redisClient.getClient();
    const encrypted = await redis.get(`secret:${key}`);

    if (!encrypted) {
      return null;
    }

    return decrypt(encrypted);
  } catch (error) {
    logger.error({ error, key }, 'Failed to get secret');
    return null;
  }
}

/**
 * Delete secret
 */
export async function deleteSecret(key: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    await redis.del(`secret:${key}`);
    logger.debug({ key }, 'Secret deleted');
  } catch (error) {
    logger.error({ error, key }, 'Failed to delete secret');
  }
}

/**
 * Rotate encryption key
 * This should be done carefully in production with proper key management
 */
export function rotateEncryptionKey(): void {
  logger.warn('Encryption key rotation requested - implement proper key rotation strategy');
  // In production, this should:
  // 1. Generate new key
  // 2. Re-encrypt all data with new key
  // 3. Update key in secrets management service
  // 4. Keep old key for decryption during transition
  // 5. Remove old key after transition period
}

/**
 * Validate that encryption key is set (call on startup)
 */
export function validateEncryptionKey(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPTION_KEY) {
    logger.error('ENCRYPTION_KEY not set in production - encryption will fail');
    throw new Error('ENCRYPTION_KEY must be set in production');
  }
}

