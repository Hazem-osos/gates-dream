import 'dotenv/config';

// Import environment validation FIRST - will throw if invalid
import { env } from './shared/config/env';

import app from './app';
import { logger } from './shared/logger';
import { initializeAuth } from './shared/auth/config';
import { redisClient } from './shared/cache/redis';
import {
  disconnectCacheInvalidationSubscriber,
  flushPendingCacheInvalidations,
  subscribeCacheInvalidation,
} from './shared/cache/cache-invalidation.bus';
import { clearEntireL1, clearLocalCacheByPrefix } from './shared/cache/tenant-metadata-cache';
import { sensorSubscriberService } from './modules/manufacturing/services/sensor-subscriber.service';
import { initializeTracing, shutdownTracing } from './shared/monitoring/tracing';
import { prisma, disconnectPrisma } from './shared/database/prisma';

// Wave 6 fix: an unhandled promise rejection or uncaught synchronous
// exception anywhere in the app used to have no top-level handler at all —
// Node's default behavior (crash with no cleanup, or in older Node versions,
// silently continue) meant either an ungraceful hard kill or, worse, the
// process limping along with the offending request half-processed and no
// operator ever being alerted. Log with full context and exit non-zero so
// the process manager (pm2/systemd/k8s) restarts a known-clean instance.
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection — exiting');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  const code = (error as NodeJS.ErrnoException).code;
  // Double-writing an HTTP response must not take down the whole API.
  if (code === 'ERR_HTTP_HEADERS_SENT') {
    logger.error({ error }, 'Response already sent — keeping process alive');
    return;
  }
  logger.error({ error }, 'Uncaught exception — exiting');
  process.exit(1);
});

// Initialize authentication
initializeAuth();

// Initialize distributed tracing (if enabled)
initializeTracing();

// Initialize Redis (for caching and job queues)
if (env.REDIS_ENABLED) {
  redisClient.initialize();
  redisClient.onReady(() => {
    void flushPendingCacheInvalidations();
  });
  subscribeCacheInvalidation((prefix) => {
    if (prefix === '') {
      clearEntireL1();
      return;
    }
    clearLocalCacheByPrefix(prefix);
  });
}

// Initialize MQTT subscriber for manufacturing sensors
if (env.MQTT_ENABLED) {
  sensorSubscriberService.initialize();
}

// Initialize security features
import { validateEncryptionKey } from './shared/security/secrets-manager';
import { initializeCertificatePins } from './shared/security/certificate-pinning';
import { warmCacheOnStartup } from './shared/cache/cache-warmer';

try {
  validateEncryptionKey();
  logger.info('Encryption key validated');
} catch (error) {
  logger.error({ error }, 'Encryption key validation failed');
}

initializeCertificatePins();

// Schedule integrity checks (if Redis enabled)
if (env.REDIS_ENABLED) {
  // Wave 6 fix: this dynamic import was a floating, uncaught
  // `import().then()` — a failure here (module error, `scheduleIntegrityCheck`
  // throwing) used to vanish silently with no log and no crash.
  import('./shared/jobs/integrity-check.job')
    .then(({ scheduleIntegrityCheck }) => {
      scheduleIntegrityCheck();
    })
    .catch((error) => {
      logger.error({ error }, 'Failed to schedule integrity check job');
    });

  import('./modules/automation')
    .then(({ scheduleAutomationJobs }) => scheduleAutomationJobs())
    .catch((error) => {
      logger.error({ error }, 'Failed to schedule automation jobs');
    });

  import('./modules/ai/proactive/proactive.queue')
    .then(({ scheduleProactiveCfoJob, startProactiveCfoWorker }) => {
      startProactiveCfoWorker();
      return scheduleProactiveCfoJob();
    })
    .catch((error) => {
      logger.error({ error }, 'Failed to schedule proactive CFO job');
    });

  // Warm cache on startup
  warmCacheOnStartup().catch((error) => {
    logger.error({ error }, 'Cache warm-up on startup failed');
  });
}

const PORT = env.PORT;
const NODE_ENV = env.NODE_ENV;

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info({
    message: `Gates Soft ERP Backend Server is running`,
    port: PORT,
    environment: NODE_ENV,
    redisEnabled: env.REDIS_ENABLED,
    mqttEnabled: env.MQTT_ENABLED,
    frontendUrl: env.FRONTEND_URL,
  });
});

/**
 * Wave 6 fix: graceful shutdown used to call `process.exit(0)` immediately
 * after firing off a handful of disconnects — it never held the HTTP server
 * reference, never awaited `server.close()` (so in-flight requests/postings
 * were killed mid-transaction), and never awaited Prisma's disconnect (which
 * only ran on the natural `beforeExit` event, which `process.exit()` never
 * lets fire). Every deploy/restart effectively hard-killed the process.
 * Now: stop accepting new connections, let in-flight requests finish (with a
 * hard timeout as a backstop), then disconnect Prisma/Redis/MQTT/tracing in
 * order, then exit.
 */
let shuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received, shutting down gracefully');

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 30s — forcing exit');
    process.exit(1);
  }, 30_000);
  forceExitTimer.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    logger.info('HTTP server closed — no longer accepting new connections');
  } catch (error) {
    logger.error({ error }, 'Error while closing HTTP server');
  }

  await Promise.allSettled([
    disconnectPrisma(),
    shutdownTracing(),
    redisClient.disconnect(),
    disconnectCacheInvalidationSubscriber(),
    Promise.resolve(sensorSubscriberService.disconnect()),
  ]);

  clearTimeout(forceExitTimer);
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Verify the shared Prisma singleton (used by every request handler) can
// actually reach the database before we consider startup successful, rather
// than lazily discovering a bad DATABASE_URL on the first incoming request.
prisma
  .$connect()
  .then(() => logger.info('Prisma connected'))
  .catch((error) => {
    logger.error({ error }, 'Prisma failed to connect on startup');
    process.exit(1);
  });

void import('./modules/ai/rag/pg-vector.store')
  .then(({ ensurePgVectorSchema }) => ensurePgVectorSchema())
  .catch((error) => {
    logger.warn({ error }, 'Optional pgvector bootstrap skipped');
  });
