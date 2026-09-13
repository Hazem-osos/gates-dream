import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/types';
import { prisma } from '../database/prisma';
import { AppError } from './error-handler';
import { logger } from '../logger';
import { authenticate } from './auth.middleware';
import { runWithTenantContext } from '../database/tenant-context';

/**
 * Tenant Isolation Middleware
 * Sets tenant context for application-level data isolation (MySQL-compatible)
 * Note: MySQL doesn't support Row-Level Security (RLS) like PostgreSQL.
 * Tenant isolation is handled at the application level by filtering queries with companyId.
 */

/**
 * Sets tenant context for application-level data isolation
 * This middleware validates the company exists and is active.
 * All service queries must explicitly filter by companyId for tenant isolation.
 */
export const setTenantContext = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get tenant ID from authenticated user
    const tenantId = req.tenantId || req.companyId;

    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required');
    }

    // Verify tenant exists and is active
    // This ensures data isolation at the application level
    const company = await prisma.company.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });

    if (!company) {
      throw new AppError(404, 'Company not found');
    }

    if (!company.isActive) {
      throw new AppError(403, 'Company account is inactive');
    }

    // Store tenant context in request object for use in services
    // Services must filter queries by companyId for tenant isolation
    req.companyId = tenantId;
    req.tenantId = tenantId;

    // Note: MySQL doesn't support session variables like PostgreSQL
    // All queries must explicitly include companyId in WHERE clauses
    // Example: WHERE company_id = ${req.companyId}

    logger.debug(
      {
        tenantId,
        companyId: req.companyId,
        branchId: req.branchId,
      },
      'Tenant context set (application-level isolation)'
    );

    // Item 37 (Phase 6): bind companyId to AsyncLocalStorage for the rest of
    // this request's async call chain, so the Prisma tenant-scoping
    // extension can enforce it centrally — a defense-in-depth backstop
    // underneath (not instead of) the explicit `companyId` filters services
    // already apply.
    //
    // `await`ed (rather than fire-and-forget) so a synchronous throw from
    // `next()` — turned into a rejected promise by `runWithTenantContext`'s
    // internal `async () => fn()` wrapper (see its docstring) — still lands
    // in this `catch` block instead of becoming an unhandled rejection.
    await runWithTenantContext(req.companyId, next);
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    logger.error({ error }, 'Error setting tenant context');
    next(new AppError(500, 'Failed to set tenant context'));
  }
};

/**
 * Combined middleware for authentication + tenant context
 * Use this for routes that require both authentication and tenant isolation
 */
export const authenticateAndSetTenant = [authenticate, setTenantContext];