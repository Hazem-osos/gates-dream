import { redisClient } from '../cache/redis';
import { env } from '../config/env';
import prisma from '../database/prisma';
import axios from 'axios';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: DependencyCheck;
    redis?: DependencyCheck;
    mqtt?: DependencyCheck;
    keycloak?: DependencyCheck;
  };
}

export interface DependencyCheck {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
  error?: string;
}

export class HealthChecker {
  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<DependencyCheck> {
    const startTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<DependencyCheck> {
    if (!env.REDIS_ENABLED) {
      return {
        status: 'healthy',
        message: 'Redis not enabled',
      };
    }

    const startTime = Date.now();
    try {
      const client = redisClient.getClient();
      await client.ping();
      const responseTime = Date.now() - startTime;
      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  /**
   * Check MQTT connectivity
   */
  private async checkMQTT(): Promise<DependencyCheck> {
    if (!env.MQTT_ENABLED) {
      return {
        status: 'healthy',
        message: 'MQTT not enabled',
      };
    }

    // MQTT check is basic - just verify configuration exists
    // Actual connection is managed by the sensor subscriber service
    try {
      if (!env.MQTT_URL) {
        return {
          status: 'unhealthy',
          error: 'MQTT_URL not configured',
        };
      }
      return {
        status: 'healthy',
        message: 'MQTT configured',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'MQTT check failed',
      };
    }
  }

  /**
   * Check Keycloak connectivity
   */
  private async checkKeycloak(): Promise<DependencyCheck> {
    if (!env.KEYCLOAK_ENABLED) {
      return {
        status: 'healthy',
        message: 'Keycloak not enabled',
      };
    }

    const startTime = Date.now();
    try {
      if (!env.KEYCLOAK_SERVER_URL || !env.KEYCLOAK_REALM) {
        return {
          status: 'unhealthy',
          error: 'Keycloak configuration incomplete',
        };
      }

      // Check Keycloak health endpoint
      const healthUrl = `${env.KEYCLOAK_SERVER_URL}/health`;
      const response = await axios.get(healthUrl, {
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;
      return {
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        responseTime,
      };
    } catch (error) {
      // If Keycloak is not available, we can still operate (degraded mode)
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Keycloak connection failed',
      };
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkDatabase(),
      ...(env.REDIS_ENABLED && { redis: await this.checkRedis() }),
      ...(env.MQTT_ENABLED && { mqtt: await this.checkMQTT() }),
      ...(env.KEYCLOAK_ENABLED && { keycloak: await this.checkKeycloak() }),
    };

    // Determine overall status
    const allChecks = Object.values(checks);
    const unhealthyCount = allChecks.filter((c) => c.status === 'unhealthy').length;
    const criticalUnhealthy = checks.database.status === 'unhealthy';

    let status: 'healthy' | 'unhealthy' | 'degraded';
    if (criticalUnhealthy) {
      status = 'unhealthy';
    } else if (unhealthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  }

  /**
   * Liveness probe - basic check that app is running
   */
  async livenessCheck(): Promise<boolean> {
    try {
      // Just check if we can query the database
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Readiness probe - check if app is ready to serve traffic
   */
  async readinessCheck(): Promise<boolean> {
    const health = await this.performHealthCheck();
    // App is ready if database is healthy (critical dependency)
    return health.checks.database.status === 'healthy';
  }
}

export const healthChecker = new HealthChecker();

