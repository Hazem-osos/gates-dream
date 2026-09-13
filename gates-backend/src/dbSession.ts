import { PrismaClient } from '@prisma/client';

export type SessionCtx = {
  tenantId: string;
  userId: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

/**
 * MySQL-compatible database session wrapper
 * Note: MySQL doesn't support session variables like PostgreSQL
 * Session context is passed to the function for application-level use
 * All queries must explicitly filter by tenantId/userId
 */
export async function withDbSessionSettings<T>(
  prisma: PrismaClient,
  ctx: SessionCtx,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  // MySQL doesn't support set_config - session context is handled at application level
  // The context is available in ctx parameter for use in queries
  return prisma.$transaction(async (tx) => {
    // Note: In MySQL, tenant isolation is handled by filtering queries with companyId
    // The ctx parameter contains tenantId/userId for use in WHERE clauses
    return fn(tx as unknown as PrismaClient);
  });
}


