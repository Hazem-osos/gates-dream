import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';
import { env } from '../config/env';

/**
 * Read Replica Prisma Client
 * Use this for read-only queries (reports, analytics)
 * Falls back to main database if replica not configured
 */

const globalForPrismaRead = global as unknown as { prismaRead: PrismaClient };

export const prismaRead =
  globalForPrismaRead.prismaRead ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        // Use read replica if configured, otherwise fall back to main database
        url: env.REPLICA_DATABASE_URL || env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaRead.prismaRead = prismaRead;
}

// Log read replica status
if (env.REPLICA_DATABASE_URL) {
  logger.info('Read replica database configured');
} else {
  logger.info('Read replica not configured, using main database for reads');
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prismaRead.$disconnect();
  logger.info('Prisma read client disconnected');
});

export default prismaRead;

