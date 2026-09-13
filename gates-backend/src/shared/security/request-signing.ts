import * as crypto from 'crypto';
import { logger } from '../logger';

/**
 * Request Signing for External APIs
 * Implements HMAC request signing for secure API communication
 */

export interface SigningConfig {
  secret: string;
  algorithm?: 'sha256' | 'sha512';
  includeTimestamp?: boolean;
  timestampTolerance?: number; // seconds
}

const DEFAULT_ALGORITHM = 'sha256';
const DEFAULT_TIMESTAMP_TOLERANCE = 300; // 5 minutes

/**
 * Sign request
 */
export function signRequest(
  method: string,
  url: string,
  body: string | object,
  config: SigningConfig
): {
  signature: string;
  timestamp: number;
  headers: Record<string, string>;
} {
  const algorithm = config.algorithm || DEFAULT_ALGORITHM;
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

  // Create signature string
  const signatureString = [
    method.toUpperCase(),
    url,
    bodyString,
    config.includeTimestamp !== false ? timestamp.toString() : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Generate HMAC signature
  const hmac = crypto.createHmac(algorithm, config.secret);
  hmac.update(signatureString);
  const signature = hmac.digest('hex');

  // Prepare headers
  const headers: Record<string, string> = {
    'X-Signature': signature,
    'X-Signature-Algorithm': algorithm,
  };

  if (config.includeTimestamp !== false) {
    headers['X-Timestamp'] = timestamp.toString();
  }

  return {
    signature,
    timestamp,
    headers,
  };
}

/**
 * Verify request signature
 */
export function verifyRequest(
  method: string,
  url: string,
  body: string | object,
  signature: string,
  timestamp: string | number | undefined,
  config: SigningConfig
): boolean {
  try {
    // Check timestamp if provided
    if (timestamp && config.includeTimestamp !== false) {
      const requestTime = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
      const now = Math.floor(Date.now() / 1000);
      const tolerance = config.timestampTolerance || DEFAULT_TIMESTAMP_TOLERANCE;

      if (Math.abs(now - requestTime) > tolerance) {
        logger.warn(
          {
            requestTime,
            now,
            difference: Math.abs(now - requestTime),
            tolerance,
          },
          'Request timestamp out of tolerance'
        );
        return false;
      }
    }

    // Recreate signature
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const signatureString = [
      method.toUpperCase(),
      url,
      bodyString,
      timestamp ? timestamp.toString() : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Generate expected signature
    const algorithm = config.algorithm || DEFAULT_ALGORITHM;
    const hmac = crypto.createHmac(algorithm, config.secret);
    hmac.update(signatureString);
    const expectedSignature = hmac.digest('hex');

    // Compare signatures (constant-time comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn(
        {
          url,
          method,
          expected: expectedSignature.substring(0, 10),
          received: signature.substring(0, 10),
        },
        'Request signature verification failed'
      );
    }

    return isValid;
  } catch (error) {
    logger.error({ error }, 'Request signature verification error');
    return false;
  }
}

/**
 * Create signed request middleware for outbound requests
 */
export function createSignedRequestMiddleware(config: SigningConfig) {
  return (req: any) => {
    const { headers } = signRequest(
      req.method || 'GET',
      req.url || '',
      req.body || {},
      config
    );

    // Add headers to request
    req.headers = {
      ...req.headers,
      ...headers,
    };

    return req;
  };
}

/**
 * Verify signed request middleware for inbound requests
 */
export function createVerifyRequestMiddleware(config: SigningConfig) {
  return (req: any, res: any, next: any) => {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    const algorithm = req.headers['x-signature-algorithm'] || DEFAULT_ALGORITHM;

    if (!signature) {
      return void res.status(401).json({
        status: 'error',
        message: 'Missing request signature',
        code: 'MISSING_SIGNATURE',
      });
    }

    const isValid = verifyRequest(
      req.method,
      req.url,
      req.body,
      signature,
      timestamp,
      { ...config, algorithm: algorithm as 'sha256' | 'sha512' }
    );

    if (!isValid) {
      return void res.status(401).json({
        status: 'error',
        message: 'Invalid request signature',
        code: 'INVALID_SIGNATURE',
      });
    }

    next();
  };
}

