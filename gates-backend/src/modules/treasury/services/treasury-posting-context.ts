import type { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import prisma from '../../../shared/database/prisma';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import type { TreasuryPostingContext } from '../types/treasury.types';

export function buildTreasuryPostingContext(req: AuthRequest): TreasuryPostingContext {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) {
    throw new AppError(400, 'Company context is required');
  }
  if (!req.branchId) {
    throw new AppError(400, 'X-Branch-Id is required for treasury posting');
  }
  if (!req.fiscalYearId) {
    throw new AppError(400, 'X-Fiscal-Year-Id is required for treasury posting');
  }
  return {
    companyId,
    branchId: req.branchId,
    fiscalYearId: req.fiscalYearId,
    userId: req.user?.sub ?? 'system',
    isAdmin: isAdminRequest(req),
  };
}

/** Fill branch/fiscal year from tenant defaults so AUTO posting can actually run. */
export async function resolveTreasuryPostingContext(
  req: AuthRequest,
  voucherDate?: Date
): Promise<TreasuryPostingContext> {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) {
    throw new AppError(400, 'يجب تحديد الشركة قبل الترحيل التلقائي');
  }

  let branchId = req.branchId;
  if (!branchId) {
    const branch = await prisma.branch.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    branchId = branch?.id;
  }
  if (!branchId) {
    throw new AppError(422, 'الترحيل التلقائي يتطلب فرعاً — أضف فرعاً من إعدادات الشركة');
  }

  let fiscalYearId = req.fiscalYearId;
  if (!fiscalYearId && voucherDate) {
    const forDate = await fiscalYearService.resolveForDate(companyId, voucherDate);
    if (forDate.kind === 'open') fiscalYearId = forDate.fiscalYearId;
  }
  if (!fiscalYearId) {
    fiscalYearId = (await fiscalYearService.resolveDefaultFiscalYearId(companyId)) ?? undefined;
  }
  if (!fiscalYearId) {
    throw new AppError(422, 'الترحيل التلقائي يتطلب سنة مالية مفتوحة');
  }

  req.branchId = branchId;
  req.fiscalYearId = fiscalYearId;

  return {
    companyId,
    branchId,
    fiscalYearId,
    userId: req.user?.sub ?? 'system',
    isAdmin: isAdminRequest(req),
  };
}

export async function resolveDefaultTreasuryPostingContext(
  companyId: string,
  userId = 'system',
  voucherDate?: Date
): Promise<TreasuryPostingContext> {
  const branch = await prisma.branch.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!branch) {
    throw new AppError(422, 'No branch configured for treasury posting');
  }

  let fiscalYearId: string | undefined;
  if (voucherDate) {
    const forDate = await fiscalYearService.resolveForDate(companyId, voucherDate);
    if (forDate.kind === 'open') fiscalYearId = forDate.fiscalYearId;
  }
  fiscalYearId ??= (await fiscalYearService.resolveDefaultFiscalYearId(companyId)) ?? undefined;
  if (!fiscalYearId) {
    throw new AppError(422, 'No open fiscal year for treasury posting');
  }

  return {
    companyId,
    branchId: branch.id,
    fiscalYearId,
    userId,
  };
}

export function treasuryPostingContextFromIds(params: {
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  userId?: string;
}): TreasuryPostingContext {
  return {
    companyId: params.companyId,
    branchId: params.branchId,
    fiscalYearId: params.fiscalYearId,
    userId: params.userId ?? 'integration-test',
  };
}
