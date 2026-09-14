import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createPeriodSchema,
  updatePeriodSchema,
  periodQuerySchema,
} from '../schemas/period.schema';
import { periodService } from '../services/period.service';
import { journalEntryService } from '../services/journal-entry.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import prisma from '../../../shared/database/prisma';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

function companyIdOf(req: AuthRequest): string {
  const companyId = req.companyId || req.tenantId;
  if (!companyId) {
    throw new AppError(400, 'معرّف الشركة مطلوب');
  }
  return companyId;
}

function sendError(res: Response, error: unknown, fallback: string) {
  const status = error instanceof AppError ? error.statusCode : 500;
  if (!(error instanceof AppError) || error.statusCode >= 500) {
    logger.error({ error }, fallback);
  }
  return void res.status(status).json({
    status: 'error',
    message: error instanceof Error ? error.message : fallback,
  });
}

async function postingContext(req: AuthRequest) {
  const companyId = companyIdOf(req);
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
    throw new AppError(400, 'يجب اختيار فرع قبل فتح أو إغلاق الفترة');
  }
  return journalEntryService.buildPostingContext(
    companyId,
    branchId,
    req.user?.sub ?? 'system',
    req.fiscalYearId,
    isAdminRequest(req)
  );
}

router.get(
  '/',
  authorize({ resource: 'period', action: 'view' }),
  validate({ query: periodQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = companyIdOf(req);
      const result = await periodService.listPeriods(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        isClosed: req.query.isClosed as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.periods,
        nextStartDate: result.nextStartDate,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, error, 'تعذّر تحميل الفترات');
    }
  }
);

router.get(
  '/current',
  authorize({ resource: 'period', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const period = await periodService.getCurrentPeriod(companyIdOf(req));
      return void res.json({ status: 'success', data: period });
    } catch (error) {
      return sendError(res, error, 'تعذّر تحميل الفترة الحالية');
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'period', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const period = await periodService.getPeriodById(companyIdOf(req), req.params.id);
      return void res.json({ status: 'success', data: period });
    } catch (error) {
      return sendError(res, error, 'تعذّر تحميل الفترة');
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'period', action: 'edit' }),
  validate({ body: createPeriodSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = {
        ...req.body,
        startDate:
          typeof req.body.startDate === 'string' ? new Date(req.body.startDate) : req.body.startDate,
        endDate: typeof req.body.endDate === 'string' ? new Date(req.body.endDate) : req.body.endDate,
      };
      const period = await periodService.createPeriod(companyIdOf(req), data);
      return void res.status(201).json({
        status: 'success',
        message: 'تم حفظ الفترة',
        data: period,
      });
    } catch (error) {
      return sendError(res, error, 'تعذّر حفظ الفترة');
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'period', action: 'edit' }),
  validate({ body: updatePeriodSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data: Record<string, unknown> = { ...req.body };
      if (req.body.startDate) {
        data.startDate =
          typeof req.body.startDate === 'string' ? new Date(req.body.startDate) : req.body.startDate;
      }
      if (req.body.endDate) {
        data.endDate =
          typeof req.body.endDate === 'string' ? new Date(req.body.endDate) : req.body.endDate;
      }
      const period = await periodService.updatePeriod(companyIdOf(req), req.params.id, data);
      return void res.json({
        status: 'success',
        message: 'تم تحديث الفترة',
        data: period,
      });
    } catch (error) {
      return sendError(res, error, 'تعذّر تحديث الفترة');
    }
  }
);

router.post(
  '/:id/close',
  authorize({ resource: 'period', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = await postingContext(req);
      const period = await periodService.closePeriod(companyIdOf(req), req.params.id, ctx);
      return void res.json({
        status: 'success',
        message: 'تم إغلاق الفترة المالية',
        data: period,
      });
    } catch (error) {
      return sendError(res, error, 'تعذّر إغلاق الفترة');
    }
  }
);

router.post(
  '/:id/reopen',
  authorize({ resource: 'period', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = await postingContext(req);
      const period = await periodService.reopenPeriod(companyIdOf(req), req.params.id, ctx);
      return void res.json({
        status: 'success',
        message: 'تم فتح الفترة المالية',
        data: period,
      });
    } catch (error) {
      return sendError(res, error, 'تعذّر فتح الفترة');
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'period', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      await periodService.deletePeriod(companyIdOf(req), req.params.id);
      return void res.json({
        status: 'success',
        message: 'تم حذف الفترة',
      });
    } catch (error) {
      return sendError(res, error, 'تعذّر حذف الفترة');
    }
  }
);

export default router;
