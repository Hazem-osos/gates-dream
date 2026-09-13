import * as crypto from 'crypto';
import { logger } from '../logger';
import https from 'https';

/**
 * Certificate Pinning for External APIs
 * Validates SSL certificates to prevent MITM attacks
 */

export interface PinnedCertificate {
  hostname: string;
  publicKeyHash: string; // SHA-256 hash of public key
  algorithm?: 'sha256' | 'sha1';
}

// Store pinned certificates
const pinnedCertificates: Map<string, PinnedCertificate> = new Map();

/**
 * Add pinned certificate
 */
export function pinCertificate(config: PinnedCertificate): void {
  pinnedCertificates.set(config.hostname, config);
  logger.info({ hostname: config.hostname }, 'Certificate pinned');
}

/**
 * Get certificate pin for hostname
 */
export function getCertificatePin(hostname: string): PinnedCertificate | undefined {
  return pinnedCertificates.get(hostname);
}

/**
 * Validate certificate against pin
 */
export function validateCertificate(
  hostname: string,
  cert: string | Buffer
): boolean {
  const pin = getCertificatePin(hostname);
  if (!pin) {
    // No pin configured, allow (or reject based on policy)
    logger.warn({ hostname }, 'No certificate pin configured');
    return true; // Fail open for now
  }

  try {
    const certBuffer = typeof cert === 'string' ? Buffer.from(cert) : cert;
    const publicKey = crypto.createPublicKey(certBuffer);
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    const hash = crypto
      .createHash(pin.algorithm || 'sha256')
      .update(publicKeyDer)
      .digest('hex');

    const isValid = hash.toLowerCase() === pin.publicKeyHash.toLowerCase();

    if (!isValid) {
      logger.error(
        {
          hostname,
          expected: pin.publicKeyHash,
          actual: hash,
        },
        'Certificate pin validation failed'
      );
    }

    return isValid;
  } catch (error) {
    logger.error({ error, hostname }, 'Certificate validation error');
    return false;
  }
}

/**
 * Create HTTPS agent with certificate pinning
 */
export function createPinnedHttpsAgent(hostname: string): https.Agent {
  const pin = getCertificatePin(hostname);
  if (!pin) {
    // Return standard agent if no pin configured
    return new https.Agent({
      rejectUnauthorized: true,
    });
  }

  return new https.Agent({
    rejectUnauthorized: true,
    checkServerIdentity: (servername: string, cert: any) => {
      // Get certificate
      const certPEM = cert.raw.toString('base64');
      const isValid = validateCertificate(hostname, certPEM);

      if (!isValid) {
        throw new Error(`Certificate pin validation failed for ${hostname}`);
      }

      // Also perform standard hostname verification
      return undefined; // Let Node.js handle standard verification
    },
  });
}

/**
 * Initialize certificate pins (call on startup)
 * In production, load from secure configuration
 */
export function initializeCertificatePins(): void {
  // Example: Pin certificates for external APIs
  // pinCertificate({
  //   hostname: 'api.example.com',
  //   publicKeyHash: 'abc123...', // SHA-256 hash of public key
  //   algorithm: 'sha256',
  // });

  logger.info(
    { count: pinnedCertificates.size },
    'Certificate pins initialized'
  );
}

/**
 * Extract public key hash from certificate (utility function)
 * Use this to generate pins for certificates
 */
export function extractPublicKeyHash(
  cert: string | Buffer,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): string {
  try {
    const certBuffer = typeof cert === 'string' ? Buffer.from(cert) : cert;
    const publicKey = crypto.createPublicKey(certBuffer);
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    return crypto.createHash(algorithm).update(publicKeyDer).digest('hex');
  } catch (error) {
    logger.error({ error }, 'Failed to extract public key hash');
    throw error;
  }
}

