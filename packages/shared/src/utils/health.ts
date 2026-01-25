/**
 * Health Check System
 */

import { IHealthCheck, HealthStatus, ComponentHealth } from '../interfaces/index.js';
import { checkDbConnection } from '../db/client.js';
import { Redis } from 'ioredis';
import { createLogger } from './logger.js';

const logger = createLogger('health');

export interface HealthCheckConfig {
  serviceName: string;
  redis?: Redis;
  additionalChecks?: Array<{
    name: string;
    check: () => Promise<{ healthy: boolean; message?: string }>;
  }>;
}

export class HealthChecker implements IHealthCheck {
  private serviceName: string;
  private redis: Redis | null;
  private additionalChecks: HealthCheckConfig['additionalChecks'];

  constructor(config: HealthCheckConfig) {
    this.serviceName = config.serviceName;
    this.redis = config.redis || null;
    this.additionalChecks = config.additionalChecks;
  }

  async check(): Promise<HealthStatus> {
    const components: ComponentHealth[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check database
    const dbHealth = await this.checkDatabase();
    components.push(dbHealth);
    if (dbHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (dbHealth.status === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    // Check Redis
    if (this.redis) {
      const redisHealth = await this.checkRedis();
      components.push(redisHealth);
      if (redisHealth.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (redisHealth.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    // Run additional checks
    if (this.additionalChecks) {
      for (const check of this.additionalChecks) {
        const health = await this.runCheck(check.name, check.check);
        components.push(health);
        if (health.status === 'unhealthy' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }
    }

    return {
      status: overallStatus,
      components,
      timestamp: new Date(),
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const isConnected = await checkDbConnection();
      const latency = Date.now() - start;

      return {
        name: 'database',
        status: isConnected ? 'healthy' : 'unhealthy',
        latency,
        message: isConnected ? null : 'Database connection failed',
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        latency: Date.now() - start,
        message: (error as Error).message,
      };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.redis!.ping();
      const latency = Date.now() - start;

      return {
        name: 'redis',
        status: 'healthy',
        latency,
        message: null,
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        latency: Date.now() - start,
        message: (error as Error).message,
      };
    }
  }

  private async runCheck(
    name: string,
    checkFn: () => Promise<{ healthy: boolean; message?: string }>
  ): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const result = await checkFn();
      const latency = Date.now() - start;

      return {
        name,
        status: result.healthy ? 'healthy' : 'degraded',
        latency,
        message: result.message || null,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        latency: Date.now() - start,
        message: (error as Error).message,
      };
    }
  }
}

// Express/HTTP health endpoint handler
export function createHealthHandler(checker: HealthChecker) {
  return async (req: unknown, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
    try {
      const health = await checker.check();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      res.status(503).json({
        status: 'unhealthy',
        components: [],
        timestamp: new Date(),
        error: (error as Error).message,
      });
    }
  };
}
