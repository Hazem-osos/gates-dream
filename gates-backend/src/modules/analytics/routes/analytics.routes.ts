import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { executiveAnalyticsService } from '../services/executive-analytics.service';
import { dailyDigestService } from '../services/daily-digest.service';
import { sentinelAlertsService } from '../services/sentinel-alerts.service';
import { endOfDayUtc } from '../../../shared/utils/report-date';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function parseDate(value: unknown, field: string): Date {
  if (!value || typeof value !== 'string') {
    throw new AppError(400, `${field} is required (ISO date)`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(400, `Invalid ${field}`);
  return d;
}

// M15 fix: an `asOfDate` report filter must include everything posted on
// that calendar day, not just entries at exactly UTC midnight.
function parseAsOfDate(value: unknown, field: string): Date {
  try {
    return endOfDayUtc(value, field);
  } catch (e) {
    throw new AppError(400, e instanceof Error ? e.message : `Invalid ${field}`);
  }
}

router.get(
  '/aging',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const partyType = req.query.partyType as string;
      if (partyType !== 'CUSTOMER' && partyType !== 'SUPPLIER') {
        throw new AppError(400, 'partyType must be CUSTOMER or SUPPLIER');
      }

      const data = await executiveAnalyticsService.getAgingReport({
        companyId,
        branchId: (req.query.branchId as string) || undefined,
        asOfDate: parseAsOfDate(req.query.asOfDate, 'asOfDate'),
        partyType,
      });
      if (!res.headersSent) {
        return void res.json({ status: 'success', data });
      }
      return;
    } catch (e) {
      if (res.headersSent) return;
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'AR/AP aging report failed',
      });
    }
  }
);

router.get(
  '/executive-kpis',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const months = req.query.months ? parseInt(String(req.query.months), 10) : undefined;

      const data = await executiveAnalyticsService.getExecutiveKpis({
        companyId,
        branchId: (req.query.branchId as string) || undefined,
        months,
      });
      if (!res.headersSent) {
        return void res.json({ status: 'success', data });
      }
      return;
    } catch (e) {
      if (res.headersSent) return;
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Executive KPIs failed',
      });
    }
  }
);

router.get(
  '/daily-digest',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const date =
        typeof req.query.date === 'string' && req.query.date
          ? parseDate(req.query.date, 'date')
          : new Date();

      const data = await dailyDigestService.getDailyDigest({
        companyId,
        branchId: (req.query.branchId as string) || undefined,
        date,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      if (res.headersSent) return;
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Daily digest failed',
      });
    }
  }
);

router.get(
  '/sentinel-alerts',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const data = await sentinelAlertsService.getAlerts({
        companyId,
        branchId: (req.query.branchId as string) || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      if (res.headersSent) return;
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Sentinel alerts failed',
      });
    }
  }
);

export default router;
