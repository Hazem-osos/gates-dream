import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createOpeningStockSchema,
  openingStockQuerySchema,
} from '../schemas/opening-stock.schema';
import { openingStockService } from '../services/opening-stock.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/opening-stock
 * Create opening stock entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createOpeningStockSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const openingStock = await openingStockService.createOpeningStock(
        companyId,
        {
          companyId,
          branchId: req.body.branchId || req.branchId || undefined,
          description: req.body.description,
          serial: req.body.serial,
          date: req.body.date,
          lines: req.body.lines,
        },
        buildStockGlPostingContext(req, companyId)
      );

      logger.info(
        { companyId, openingStockId: openingStock.id },
        'Opening stock created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Opening stock created successfully',
        data: openingStock,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating opening stock');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('غير موجود') ||
          error.message.includes('do not belong'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تعذر حفظ بضاعة أول المدة',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/opening-stock
 * List opening stock entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: openingStockQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await openingStockService.listOpeningStock(companyId, {
        branchId: req.query.branchId as string | undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        isApproved: req.query.isApproved as boolean | undefined,
        isCancelled: req.query.isCancelled as boolean | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        search: req.query.search as string | undefined,
        skip: req.query.skip as number | undefined,
        take: req.query.take as number | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: {
          total: result.total,
          skip: result.skip,
          take: result.take,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error listing opening stock');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error && error.message
            ? error.message
            : 'تعذر تحميل كشوف بضاعة أول المدة',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/opening-stock/total-valuation
 * Σ (qty × unit cost) of opening-stock lines for the active fiscal year.
 * Registered before `/:id` so "total-valuation" is not parsed as an id.
 */
router.get(
  '/total-valuation',
  authorize({ resource: 'invoice', action: 'view' }),
  tenantAndFiscalContextMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = await openingStockService.getTotalValuation(
        companyId,
        req.fiscalYearId
      );

      return void res.json({
        status: 'success',
        data,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error computing opening-stock total valuation');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تعذر احتساب قيمة بضاعة أول المدة',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/opening-stock/:id
 * Get opening stock by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const openingStock = await openingStockService.getOpeningStockById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: openingStock,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting opening stock');
      const status =
        error instanceof Error && error.message === 'Opening stock not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get opening stock',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/opening-stock/:id/post
 * Post opening stock
 */
router.post(
  '/:id/post',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const openingStock = await openingStockService.postOpeningStock(
        companyId,
        req.params.id,
        buildStockGlPostingContext(req, companyId)
      );

      logger.info({ companyId, openingStockId: req.params.id }, 'Opening stock posted');

      return void res.json({
        status: 'success',
        message: 'Opening stock posted successfully',
        data: openingStock,
      });
    } catch (error) {
      logger.error({ error }, 'Error posting opening stock');
      const status =
        error instanceof Error &&
        (error.message === 'Opening stock not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to post opening stock',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/opening-stock/:id/unpost
 * Unpost opening stock
 */
router.post(
  '/:id/unpost',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await openingStockService.unpostOpeningStock(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, openingStockId: req.params.id }, 'Opening stock unposted');

      return void res.json({
        status: 'success',
        message: 'Opening stock unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting opening stock');
      const status =
        error instanceof Error &&
        (error.message === 'Opening stock not found' ||
          error.message.includes('not posted'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unpost opening stock',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/opening-stock/:id/cancel
 * Cancel opening stock
 */
router.post(
  '/:id/cancel',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const openingStock = await openingStockService.cancelOpeningStock(
        companyId,
        req.params.id,
        buildStockGlPostingContext(req, companyId)
      );

      logger.info({ companyId, openingStockId: req.params.id }, 'Opening stock cancelled');

      return void res.json({
        status: 'success',
        message: 'Opening stock cancelled successfully',
        data: openingStock,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling opening stock');
      const status =
        error instanceof Error &&
        (error.message === 'Opening stock not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel opening stock',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/opening-stock/:id/restore
 * Restore cancelled opening stock
 */
router.post(
  '/:id/restore',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const openingStock = await openingStockService.restoreOpeningStock(
        companyId,
        req.params.id,
        buildStockGlPostingContext(req, companyId)
      );

      logger.info({ companyId, openingStockId: req.params.id }, 'Opening stock restored');

      return void res.json({
        status: 'success',
        message: 'Opening stock restored successfully',
        data: openingStock,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring opening stock');
      const status =
        error instanceof Error &&
        (error.message === 'Opening stock not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore opening stock',
      });
    }
  }
);

export default router;

