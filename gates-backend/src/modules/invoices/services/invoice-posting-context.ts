import type { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import prisma from '../../../shared/database/prisma';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import type { InvoicePostingContext } from '../types/invoice-posting.types';
export function buildInvoicePostingContext(req: AuthRequest): InvoicePostingContext {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) {
    throw new AppError(400, 'Company context is required');
  }
  if (!req.branchId) {
    throw new AppError(400, 'X-Branch-Id is required for invoice posting');
  }
  if (!req.fiscalYearId) {
    throw new AppError(400, 'X-Fiscal-Year-Id is required for invoice posting');
  }
  return {
    companyId,
    branchId: req.branchId,
    fiscalYearId: req.fiscalYearId,
    userId: req.user?.sub ?? 'system',
    isAdmin: isAdminRequest(req),
  };
}

export function invoicePostingContextFromIds(params: {
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  userId?: string;
}): InvoicePostingContext {
  return {
    companyId: params.companyId,
    branchId: params.branchId,
    fiscalYearId: params.fiscalYearId,
    userId: params.userId ?? 'integration-test',
  };
}

/** Fallback when legacy callers omit branch/fiscal headers (e.g. POS). */
export async function resolveDefaultInvoicePostingContext(
  companyId: string,
  userId = 'system'
): Promise<InvoicePostingContext> {
  const branch = await prisma.branch.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!branch) {
    throw new AppError(422, 'No branch configured for invoice posting');
  }

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { companyId, status: 'Open', isActive: true },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });
  if (!fiscalYear) {
    throw new AppError(422, 'No open fiscal year for invoice posting');
  }

  return {
    companyId,
    branchId: branch.id,
    fiscalYearId: fiscalYear.id,
    userId,
  };
}
