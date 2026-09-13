import { Request, Response } from 'express';
import { logger } from '../logger';

/**
 * Simple in-memory metrics collector
 * For production, use Prometheus client library
 */
export interface Metrics {
  httpRequests: {
    total: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
  };
  httpResponseTime: {
    count: number;
    sum: number;
    min: number;
    max: number;
  };
  databaseQueries: {
    total: number;
    slow: number; // Queries > 1000ms
  };
  cacheOperations: {
    hits: number;
    misses: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

class MetricsCollector {
  private metrics: Metrics = {
    httpRequests: {
      total: 0,
      byMethod: {},
      byStatus: {},
    },
    httpResponseTime: {
      count: 0,
      sum: 0,
      min: Infinity,
      max: 0,
    },
    databaseQueries: {
      total: 0,
      slow: 0,
    },
    cacheOperations: {
      hits: 0,
      misses: 0,
    },
    memory: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
    },
  };

  /**
   * Record HTTP request
   */
  recordHttpRequest(method: string, statusCode: number, responseTime: number): void {
    this.metrics.httpRequests.total++;
    this.metrics.httpRequests.byMethod[method] =
      (this.metrics.httpRequests.byMethod[method] || 0) + 1;
    this.metrics.httpRequests.byStatus[statusCode] =
      (this.metrics.httpRequests.byStatus[statusCode] || 0) + 1;

    // Response time metrics
    this.metrics.httpResponseTime.count++;
    this.metrics.httpResponseTime.sum += responseTime;
    this.metrics.httpResponseTime.min = Math.min(
      this.metrics.httpResponseTime.min,
      responseTime
    );
    this.metrics.httpResponseTime.max = Math.max(
      this.metrics.httpResponseTime.max,
      responseTime
    );
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(duration: number): void {
    this.metrics.databaseQueries.total++;
    if (duration > 1000) {
      this.metrics.databaseQueries.slow++;
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.metrics.cacheOperations.hits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.metrics.cacheOperations.misses++;
  }

  /**
   * Get all metrics
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusFormat(): string {
    const m = this.metrics;
    const cacheHitRate =
      m.cacheOperations.hits + m.cacheOperations.misses > 0
        ? m.cacheOperations.hits /
          (m.cacheOperations.hits + m.cacheOperations.misses)
        : 0;
    const avgResponseTime =
      m.httpResponseTime.count > 0
        ? m.httpResponseTime.sum / m.httpResponseTime.count
        : 0;

    return `# HTTP Requests
http_requests_total ${m.httpRequests.total}
http_requests_by_method{method="GET"} ${m.httpRequests.byMethod.GET || 0}
http_requests_by_method{method="POST"} ${m.httpRequests.byMethod.POST || 0}
http_requests_by_method{method="PUT"} ${m.httpRequests.byMethod.PUT || 0}
http_requests_by_method{method="DELETE"} ${m.httpRequests.byMethod.DELETE || 0}

# HTTP Response Time
http_response_time_avg ${avgResponseTime}
http_response_time_min ${m.httpResponseTime.min === Infinity ? 0 : m.httpResponseTime.min}
http_response_time_max ${m.httpResponseTime.max}

# Database Queries
database_queries_total ${m.databaseQueries.total}
database_queries_slow ${m.databaseQueries.slow}

# Cache Operations
cache_hits_total ${m.cacheOperations.hits}
cache_misses_total ${m.cacheOperations.misses}
cache_hit_rate ${cacheHitRate}

# Memory Usage
memory_heap_used_bytes ${m.memory.heapUsed}
memory_heap_total_bytes ${m.memory.heapTotal}
memory_external_bytes ${m.memory.external}
memory_rss_bytes ${m.memory.rss}
`;
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    };

    // Alert on high memory usage (>80% of heap)
    const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
    if (heapUsagePercent > 80) {
      logger.warn(
        {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          heapUsagePercent: heapUsagePercent.toFixed(2),
          rss: usage.rss,
        },
        'High memory usage detected'
      );
    }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      httpRequests: {
        total: 0,
        byMethod: {},
        byStatus: {},
      },
      httpResponseTime: {
        count: 0,
        sum: 0,
        min: Infinity,
        max: 0,
      },
      databaseQueries: {
        total: 0,
        slow: 0,
      },
      cacheOperations: {
        hits: 0,
        misses: 0,
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
      },
    };
  }
}

export const metricsCollector = new MetricsCollector();

/**
 * Middleware to collect HTTP metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: () => void): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    metricsCollector.recordHttpRequest(req.method, res.statusCode, responseTime);
  });

  next();
}

