// @ts-nocheck — Prisma `$on('query')` event payload types vary by client version
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';
import { metricsCollector } from '../monitoring/metrics';

/**
 * Query Performance Monitor
 * Tracks slow queries, N+1 query patterns, and provides performance insights
 */

interface QueryInfo {
  query: string;
  params: string;
  duration: number;
  target: string;
  timestamp: number;
}

// Track recent queries for N+1 detection
const recentQueries: Map<string, QueryInfo[]> = new Map();
const N1_DETECTION_WINDOW = 1000; // 1 second window
const N1_THRESHOLD = 5; // 5+ similar queries in window indicates N+1

export function monitorPrisma(prisma: PrismaClient): void {
  const slowQueryThreshold = 1000; // 1 second (aligned with alerting threshold)

  // Monitor query events
  prisma.$on('query', async (e) => {
    const queryDurationMs = e.duration;
    const queryInfo: QueryInfo = {
      query: e.query,
      params: e.params,
      duration: queryDurationMs,
      target: e.target || 'unknown',
      timestamp: Date.now(),
    };

    // Log slow queries (>1s)
    if (queryDurationMs > slowQueryThreshold) {
      logger.warn(
        {
          query: e.query,
          params: e.params,
          duration: queryDurationMs,
          target: e.target,
        },
        'Slow database query detected (>1s)'
      );
    }

    // Detect N+1 query patterns
    detectN1Queries(queryInfo);

    metricsCollector.recordDatabaseQuery(queryDurationMs);
  });

  // Monitor errors
  prisma.$on('error', async (e) => {
    const message = String(e.message ?? '');
    if (
      /disconnect|server has gone away|closed|SIGINT|SIGTERM|ConnectionReset|Can't reach database|P1001|P1017|PrismaClientKnownRequestError/i.test(
        message
      )
    ) {
      logger.warn({ message, target: e.target }, 'Prisma connection dropped');
      return;
    }
    logger.error(
      {
        message,
        target: e.target,
      },
      'Prisma client error'
    );

    metricsCollector.recordDatabaseQuery(0);
  });
}

/**
 * Detect N+1 query patterns
 * N+1 occurs when multiple similar queries are executed in quick succession
 */
function detectN1Queries(queryInfo: QueryInfo): void {
  const now = Date.now();
  const windowStart = now - N1_DETECTION_WINDOW;

  // Create a key from the query pattern (normalize parameters)
  const queryKey = normalizeQuery(queryInfo.query);

  // Get recent queries for this pattern
  if (!recentQueries.has(queryKey)) {
    recentQueries.set(queryKey, []);
  }

  const queries = recentQueries.get(queryKey)!;

  // Remove old queries outside the window
  const recentQueriesInWindow = queries.filter((q) => q.timestamp > windowStart);

  // Add current query
  recentQueriesInWindow.push(queryInfo);

  // Update the map
  recentQueries.set(queryKey, recentQueriesInWindow);

  // Check if N+1 pattern detected
  if (recentQueriesInWindow.length >= N1_THRESHOLD) {
    logger.warn(
      {
        queryPattern: queryKey,
        count: recentQueriesInWindow.length,
        window: N1_DETECTION_WINDOW,
        target: queryInfo.target,
        sampleQuery: queryInfo.query,
      },
      'Potential N+1 query pattern detected'
    );

    // Clear the queries to avoid repeated alerts
    recentQueries.set(queryKey, []);
  }

  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to cleanup
    cleanupOldQueries(now);
  }
}

/**
 * Normalize query to detect similar patterns
 */
function normalizeQuery(query: string): string {
  // Replace UUIDs, numbers, and strings with placeholders
  return query
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '?')
    .replace(/\b\d+\b/g, '?')
    .replace(/'[^']*'/g, '?')
    .replace(/"[^"]*"/g, '?')
    .trim();
}

/**
 * Cleanup old query entries
 */
function cleanupOldQueries(now: number): void {
  const windowStart = now - N1_DETECTION_WINDOW * 10; // Keep 10x window

  for (const [key, queries] of recentQueries.entries()) {
    const recent = queries.filter((q) => q.timestamp > windowStart);
    if (recent.length === 0) {
      recentQueries.delete(key);
    } else {
      recentQueries.set(key, recent);
    }
  }
}

