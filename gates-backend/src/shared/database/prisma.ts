import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';
import { monitorPrisma } from './query-monitor';
import { env } from '../config/env';
import { tenantScopingExtensionConfig } from './tenant-scoping.extension';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Parse connection pool configuration from DATABASE_URL or use defaults
 */
function getConnectionPoolConfig() {
  const dbUrl = env.DATABASE_URL;
  const url = new URL(dbUrl);

  // Extract connection_limit and pool_timeout from URL params
  const connectionLimit = url.searchParams.get('connection_limit')
    ? parseInt(url.searchParams.get('connection_limit')!, 10)
    : getDefaultConnectionLimit();
  const poolTimeout = url.searchParams.get('pool_timeout')
    ? parseInt(url.searchParams.get('pool_timeout')!, 10)
    : 20;

  // Validate connection limit
  const validatedLimit = Math.max(1, Math.min(connectionLimit, 100)); // Between 1 and 100

  if (connectionLimit !== validatedLimit) {
    logger.warn(
      {
        requested: connectionLimit,
        validated: validatedLimit,
      },
      'Connection limit adjusted to valid range (1-100)'
    );
  }

  logger.info(
    {
      connectionLimit: validatedLimit,
      poolTimeout,
      environment: env.NODE_ENV,
    },
    'Database connection pool configured'
  );

  return {
    connectionLimit: validatedLimit,
    poolTimeout,
  };
}

/**
 * Get default connection limit based on environment
 */
function getDefaultConnectionLimit(): number {
  if (env.NODE_ENV === 'production') {
    return 20; // Production: 20 connections
  } else if (env.NODE_ENV === 'test') {
    return 5; // Test: 5 connections
  } else {
    return 10; // Development: 10 connections
  }
}

const poolConfig = getConnectionPoolConfig();

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    // Wave 4 fix: interactive transactions default to a 5s `timeout` /
    // 2s `maxWait`. Posting flows routinely acquire multiple row locks
    // (stock, journal sequence, party balances, safe/bank) across several
    // awaited queries and legitimately need more headroom than that, or a
    // transient lock wait aborts a otherwise-valid post with a generic
    // "Transaction already closed" error instead of a real business
    // failure. Raising both here is a single global default instead of
    // repeating `{ timeout, maxWait }` at each of the ~150 call sites.
    transactionOptions: {
      maxWait: 15_000,
      timeout: 30_000,
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

// Wrap Prisma client with query monitoring
monitorPrisma(basePrisma);

// Item 37 (Phase 6): every model/query call goes through the tenant-scoping
// extension from here on — see tenant-scoping.extension.ts for why this is
// additive (a no-op outside an active request's tenant context) rather than
// a behavior change for scripts/seeds/tests.
//
// `$extends()` returns a client typed against a different internal generic
// (`InternalArgs`) than plain `PrismaClient`/`Prisma.TransactionClient`,
// which — despite being runtime-identical for every argument/result shape
// used in this codebase (the extension only adds a `query` hook; it doesn't
// touch `result`/`model`/`client`) — breaks structural assignability against
// the ~60 existing `tx: Prisma.TransactionClient` service signatures used
// throughout the accounting/inventory/treasury modules (an interactive
// `prisma.$transaction(async (tx) => …)` callback receives the *extended*
// tx type). Rewriting every one of those signatures is out of scope and far
// riskier than this cast: the object returned by `$extends` still *is* a
// real (extended) PrismaClient at runtime, so casting the exported type
// back to `PrismaClient` changes nothing about behavior — the
// tenant-scoping hook still runs on every query, including inside
// `$transaction` — it only restores the pre-extension type signature so
// existing call sites keep compiling unchanged.
export const prisma = basePrisma.$extends(tenantScopingExtensionConfig) as unknown as PrismaClient;

// Connection pool configuration
// Prisma handles connection pooling automatically, configured via DATABASE_URL
// Format: mysql://user:password@localhost:3306/db?connection_limit=20&pool_timeout=10&connect_timeout=10
// Defaults: Production=20, Development=10, Test=5
// Keep-alive: long-lived Node workers reuse the pool — avoid spawning short-lived processes per request.

// Monitor connection pool usage
if (env.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      // Check active connections (MySQL)
      const result = await prisma.$queryRaw<Array<{ Threads_connected: bigint }>>`
        SHOW STATUS LIKE 'Threads_connected'
      `;
      const activeConnections = Number(result[0]?.Threads_connected || 0);
      const maxConnections = poolConfig.connectionLimit;

      if (activeConnections > maxConnections * 0.8) {
        logger.warn(
          {
            activeConnections,
            maxConnections,
            usagePercent: (activeConnections / maxConnections) * 100,
          },
          'High connection pool usage detected'
        );
      }
    } catch (error) {
      // Silently fail - connection monitoring is non-critical
      logger.debug({ error }, 'Failed to check connection pool status');
    }
  }, 60000); // Check every minute
}

// Graceful shutdown.
// `beforeExit` re-fires whenever a handler schedules more async work, so this must be
// idempotent — otherwise long-lived scripts spin forever instead of exiting.
let disconnecting = false;

// Wave 6 fix: exported so the top-level graceful-shutdown handler in
// `index.ts` can await this explicitly. `process.exit()` short-circuits the
// event loop and never lets the natural `beforeExit` event fire below, so
// without an explicit call here every deploy/restart used to hard-kill the
// process while Prisma still had in-flight queries/transactions open.
export async function disconnectPrisma(): Promise<void> {
  if (disconnecting) return;
  disconnecting = true;
  await prisma.$disconnect();
  logger.info('Prisma client disconnected');
}

process.once('beforeExit', () => {
  void disconnectPrisma();
});

export default prisma;
