/**
 * JWT Verification Service
 *
 * Supports two modes:
 *  1. Development (HS256) — tokens are signed with JWT_DEV_SECRET; no Keycloak required.
 *  2. Production  (RS256) — tokens are verified against the Keycloak JWKS endpoint.
 *
 * NOTE: No @ts-nocheck. All types are explicit.
 */

import jwt from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';
import type { JwtPayload } from './types';
import { logger } from '../logger';

// ── Public config shape (used by auth/config.ts) ────────────────────────────

export interface KeycloakConfig {
  serverUrl: string;
  realm: string;
  clientId: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

class JwtVerificationService {
  private jwksClientInstance: JwksClient | null = null;
  private config: KeycloakConfig | null = null;

  /**
   * When set, tokens are verified with HS256 (local dev; see POST /auth/login).
   * When null, Keycloak RS256 path is used.
   */
  private devSecret: string | null = null;

  // ── Initialisation ─────────────────────────────────────────────────────────

  /**
   * Production mode: verify access tokens against Keycloak's JWKS endpoint.
   */
  initialize(config: KeycloakConfig): void {
    this.devSecret = null;
    this.config = config;

    this.jwksClientInstance = jwksClient({
      jwksUri: `${config.serverUrl}/realms/${config.realm}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxAge: 86_400_000, // 24 h
    });

    logger.info({ realm: config.realm }, 'JWT verification initialised (Keycloak RS256)');
  }

  /**
   * Development mode: verify access tokens signed with HS256 using JWT_DEV_SECRET.
   * Bypasses Keycloak entirely — never use in production.
   */
  initializeDevelopment(secret: string): void {
    this.devSecret = secret;
    this.jwksClientInstance = null;
    this.config = {
      serverUrl: 'http://localhost',
      realm: 'development',
      clientId: 'gates-backend',
    };
    logger.warn('JWT verification: development HS256 mode (Keycloak bypass)');
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Fetch the RS256 signing public key for the given `kid` from the JWKS endpoint.
   */
  private async getSigningKey(kid: string): Promise<string> {
    if (!this.jwksClientInstance) {
      throw new Error('JWT verification not initialised — call initialize() first');
    }

    try {
      const key = await this.jwksClientInstance.getSigningKey(kid);
      return key.getPublicKey();
    } catch (error) {
      logger.error({ error, kid }, 'Error fetching signing key from JWKS endpoint');
      throw new Error('Failed to fetch signing key');
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Verify a JWT and return the typed payload.
   *
   * Throws `Error('Invalid or expired token')` for any verification failure —
   * the auth middleware translates this into a 401 AppError.
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    // ── Development path (HS256) ────────────────────────────────────────────
    if (this.devSecret) {
      try {
        const payload = jwt.verify(token, this.devSecret, {
          algorithms: ['HS256'],
        }) as JwtPayload;
        return payload;
      } catch (error) {
        logger.debug({ error }, 'Development HS256 JWT verification failed');
        throw new Error('Invalid or expired token');
      }
    }

    // ── Production path (Keycloak RS256) ────────────────────────────────────
    if (!this.config) {
      throw new Error('JWT verification not initialised — call initialize() first');
    }

    try {
      // Decode without verifying first — we need the `kid` from the header
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
        throw new Error('Invalid token format — missing kid header');
      }

      const publicKey = await this.getSigningKey(decoded.header.kid);

      const payload = jwt.verify(token, publicKey, {
        audience: this.config.clientId,
        issuer: `${this.config.serverUrl}/realms/${this.config.realm}`,
        algorithms: ['RS256'],
      }) as JwtPayload;

      return payload;
    } catch (error) {
      logger.error({ error }, 'RS256 token verification failed');
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Extract the raw token string from an `Authorization: Bearer <token>` header.
   * Returns `null` when the header is absent or malformed.
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7); // strips "Bearer "
  }
}

export const jwtVerificationService = new JwtVerificationService();
