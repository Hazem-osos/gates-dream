import type { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import type { PosPostingContext } from '../types/pos.types';

export function buildPosPostingContext(req: AuthRequest): PosPostingContext {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company context is required');
  if (!req.branchId) throw new AppError(400, 'X-Branch-Id is required for POS');
  if (!req.fiscalYearId) throw new AppError(400, 'X-Fiscal-Year-Id is required for POS');
  return {
    companyId,
    branchId: req.branchId,
    fiscalYearId: req.fiscalYearId,
    userId: req.user?.sub ?? 'pos-user',
  };
}

export function posPostingContextFromIds(params: {
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  userId?: string;
}): PosPostingContext {
  return {
    companyId: params.companyId,
    branchId: params.branchId,
    fiscalYearId: params.fiscalYearId,
    userId: params.userId ?? 'pos-integration-test',
  };
}
