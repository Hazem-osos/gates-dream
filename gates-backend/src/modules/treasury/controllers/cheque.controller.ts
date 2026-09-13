import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { chequeLifecycleService } from '../services/cheque-lifecycle.service';
import type { ChequeDirection, ChequeStatus } from '@prisma/client';

function requireCompanyId(req: AuthRequest, res: Response): string | null {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) {
    res.status(400).json({ status: 'error', message: 'Company ID required' });
    return null;
  }
  return companyId;
}

export async function listCheques(req: AuthRequest, res: Response) {
  const companyId = requireCompanyId(req, res);
  if (!companyId) return;

  const q = req.query as {
    direction?: ChequeDirection;
    status?: ChequeStatus;
    partyId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page?: number;
    limit?: number;
  };

  const result = await chequeLifecycleService.listCheques(companyId, q);
  return void res.json({
    status: 'success',
    data: result.items,
    items: result.items,
    total: result.total,
    page: result.page,
    totalAmount: result.totalAmount,
    pagination: result.pagination,
  });
}

export async function getChequeStats(req: AuthRequest, res: Response) {
  const companyId = requireCompanyId(req, res);
  if (!companyId) return;

  const direction = (req.query as { direction?: ChequeDirection }).direction;
  const data = await chequeLifecycleService.getChequeStats(companyId, direction);
  return void res.json({ status: 'success', data });
}

export async function getChequeById(req: AuthRequest, res: Response) {
  const companyId = requireCompanyId(req, res);
  if (!companyId) return;

  const data = await chequeLifecycleService.getCheque(companyId, req.params.id);
  return void res.json({ status: 'success', data });
}
