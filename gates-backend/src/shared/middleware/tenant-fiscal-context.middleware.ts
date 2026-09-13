import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/types';
import { AppError } from './error-handler';
import { prisma } from '../database/prisma';
import { getCachedActiveCompany } from '../cache/tenant-context.cache';
import { fiscalYearService } from '../../modules/platform/services/fiscal-year.service';
import { isAdminRequest } from '../auth/roles.util';
import { resolvePermittedBranchIds } from '../auth/branch-scope';
import { logger } from '../logger';

const HEADER_COMPANY = 'x-company-id';
const HEADER_BRANCH = 'x-branch-id';
const HEADER_FISCAL_YEAR = 'x-fiscal-year-id';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function headerString(req: AuthRequest, name: string): string | undefined {
  const raw = req.headers[name];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return undefined;
}

/**
 * Resolves company / branch / fiscal year from JWT + optional headers.
 * For mutating requests, ensures the target fiscal year is Open when provided.
 */
export async function tenantAndFiscalContextMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tokenCompanyId = req.companyId ?? req.tenantId ?? req.user?.company_id;
    const headerCompanyId = headerString(req, HEADER_COMPANY);

    let companyId = tokenCompanyId;
    if (headerCompanyId) {
      if (tokenCompanyId && headerCompanyId !== tokenCompanyId) {
        throw new AppError(403, 'X-Company-Id does not match authenticated company');
      }
      companyId = headerCompanyId;
    }

    if (!companyId) {
      throw new AppError(400, 'Company context is required');
    }

    const company = await getCachedActiveCompany(companyId);
    if (!company || !company.isActive) {
      throw new AppError(404, 'Company not found or inactive');
    }

    req.companyId = companyId;
    req.tenantId = companyId;

    const headerBranchId = headerString(req, HEADER_BRANCH);
    // An explicit header is the user's active branch selection and wins over the JWT default.
    const branchId = headerBranchId ?? req.branchId ?? req.user?.branch_id;

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, companyId, deletedAt: null },
        select: { id: true },
      });

      let resolvedBranchId = branch?.id;
      if (!resolvedBranchId) {
        const fallback = await prisma.branch.findFirst({
          where: { companyId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (!fallback) {
          throw new AppError(
            422,
            'No branch configured for this company. Add a branch in company settings or run tenant seed.'
          );
        }
        resolvedBranchId = fallback.id;
        logger.warn(
          { companyId, requestedBranchId: branchId, resolvedBranchId },
          'Invalid branch context; resolved to company default branch'
        );
      }

      // Legacy `UserBranches` (`untlogin.pas` 424-460): Admin sees every branch;
      // a non-Admin user with any explicit branch rows is restricted to them.
      // A user with zero rows is left unrestricted here (matches legacy only
      // when `UserBranchesCond` ends up open — we don't collapse to "current
      // login branch only" to avoid retroactively locking out every user this
      // table hasn't been back-filled for yet).
      //
      // This runs against the *resolved* branch, including the fallback above:
      // the check used to sit inside the `if (branch)` arm only, so sending an
      // unknown branch id silently landed a restricted user on the company's
      // default branch without any permission check at all.
      const userId = req.user?.sub;
      if (userId && !isAdminRequest(req)) {
        const permitted = await resolvePermittedBranchIds(userId, companyId);
        if (permitted && !permitted.includes(resolvedBranchId)) {
          throw new AppError(403, 'User does not have access to this branch');
        }
      }

      req.branchId = resolvedBranchId;
    }

    const headerFiscalYearId = headerString(req, HEADER_FISCAL_YEAR);
    if (headerFiscalYearId) {
      let fiscalYearId = headerFiscalYearId;
      try {
        await fiscalYearService.getById(companyId, fiscalYearId);
      } catch (err) {
        if (err instanceof AppError && err.statusCode === 404) {
          const fallback = await fiscalYearService.resolveDefaultFiscalYearId(companyId);
          if (!fallback) {
            throw new AppError(
              422,
              'No fiscal year configured for this company. Create a fiscal year or run tenant seed.'
            );
          }
          fiscalYearId = fallback;
          logger.warn(
            { companyId, requestedFiscalYearId: headerFiscalYearId, resolvedFiscalYearId: fallback },
            'Invalid fiscal year context; resolved to company default fiscal year'
          );
        } else {
          throw err;
        }
      }
      req.fiscalYearId = fiscalYearId;

      if (MUTATING_METHODS.has(req.method.toUpperCase())) {
        await fiscalYearService.assertOpenById(companyId, fiscalYearId);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard for posting/unposting endpoints: a document may only hit the ledger with an
 * explicit branch and an Open fiscal year, so the caller must send both headers.
 * Mount after `tenantAndFiscalContextMiddleware`.
 */
export async function requirePostingContext(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) throw new AppError(400, 'Company context is required');
    if (!req.branchId) {
      throw new AppError(400, 'Branch context is required for posting (send X-Branch-Id)');
    }
    if (!req.fiscalYearId) {
      throw new AppError(
        400,
        'Fiscal year context is required for posting (send X-Fiscal-Year-Id)'
      );
    }
    await fiscalYearService.assertOpenById(companyId, req.fiscalYearId);
    next();
  } catch (err) {
    next(err);
  }
}
