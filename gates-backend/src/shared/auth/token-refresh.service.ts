import axios from 'axios';
import { logger } from '../logger';

/**
 * Token Refresh Service
 * Handles token refresh with Keycloak
 */

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export class TokenRefreshService {
  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenRefreshResponse> {
    try {
      const serverUrl = process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8080';
      const realm = process.env.KEYCLOAK_REALM || 'gates-erp';
      const clientId = process.env.KEYCLOAK_CLIENT_ID || 'gates-backend';
      const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

      if (!clientSecret) {
        throw new Error('Keycloak client secret not configured');
      }

      // Keycloak token endpoint
      const tokenEndpoint = `${serverUrl}/realms/${realm}/protocol/openid-connect/token`;

      // Prepare request body
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refreshToken);
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);

      // Request new tokens from Keycloak
      const response = await axios.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const tokenData = response.data;

      logger.info({ realm, clientId }, 'Token refreshed successfully');

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type || 'Bearer',
      };
    } catch (error) {
      logger.error({ error }, 'Token refresh failed');
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error_description || error.message;
        
        if (status === 400 || status === 401) {
          throw new Error('Invalid or expired refresh token');
        }
        
        throw new Error(`Token refresh failed: ${message}`);
      }
      
      throw new Error('Token refresh failed');
    }
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const serverUrl = process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8080';
      const realm = process.env.KEYCLOAK_REALM || 'gates-erp';
      const clientId = process.env.KEYCLOAK_CLIENT_ID || 'gates-backend';
      const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

      if (!clientSecret) {
        throw new Error('Keycloak client secret not configured');
      }

      // Keycloak logout endpoint
      const logoutEndpoint = `${serverUrl}/realms/${realm}/protocol/openid-connect/logout`;

      // Prepare request body
      const params = new URLSearchParams();
      params.append('refresh_token', refreshToken);
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);

      // Revoke refresh token in Keycloak
      await axios.post(logoutEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      logger.info({ realm, clientId }, 'User logged out successfully');
    } catch (error) {
      logger.error({ error }, 'Logout failed');
      
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error_description || error.message;
        throw new Error(`Logout failed: ${message}`);
      }
      
      throw new Error('Logout failed');
    }
  }
}

export const tokenRefreshService = new TokenRefreshService();

