import { KeycloakConfig, jwtVerificationService } from './jwt.verify';
import { logger } from '../logger';
import { env } from '../config/env';

/**
 * Keycloak Configuration
 * Initialize authentication with Keycloak settings
 */

export const initializeAuth = () => {
  const serverUrl = process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8080';
  const realm = process.env.KEYCLOAK_REALM || 'gates-erp';
  const clientId = process.env.KEYCLOAK_CLIENT_ID || 'gates-backend';

  const config: KeycloakConfig = {
    serverUrl,
    realm,
    clientId,
  };

  if (env.JWT_DEV_SECRET && !env.KEYCLOAK_ENABLED) {
    jwtVerificationService.initializeDevelopment(env.JWT_DEV_SECRET);
    logger.info('Authentication: development login enabled (POST /auth/login, HS256 tokens)');
    return config;
  }

  if (env.KEYCLOAK_ENABLED) {
    try {
      jwtVerificationService.initialize(config);
      logger.info({ realm, clientId }, 'Authentication initialized with Keycloak');
    } catch (error) {
      logger.warn({ error }, 'Failed to initialize Keycloak authentication');
      logger.warn('Authentication will be disabled');
    }
  } else if (!env.JWT_DEV_SECRET) {
    logger.warn(
      'Keycloak is disabled and JWT_DEV_SECRET is not set — set JWT_DEV_SECRET (16+ chars) for local password login, or enable Keycloak.'
    );
  }

  return config;
};
