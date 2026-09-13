import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  createLandedCostAllocationSchema,
  landedCostAllocationQuerySchema,
} from '../schemas/landed-cost.schema';
import { landedCostService } from '../services/landed-cost.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

function handleError(res: Response, error: unknown, fallback: string) {
  logger.error({ error }, fallback);
  if (error instanceof AppError) {
    return void res.status(error.statusCode).json({ status: 'error', message: error.message });
  }
  return void res.status(500).json({
    status: 'error',
    message: error instanceof Error ? error.message : fallback,
  });
}

/**
 * POST /api/v1/inventory/landed-costs
 * Create a landed-cost allocation against a posted PURCHASE invoice.
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createLandedCostAllocationSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const allocation = await landedCostService.createAllocation(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        invoiceId: req.body.invoiceId,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        totalAmount: req.body.totalAmount,
        expenseAccountId: req.body.expenseAccountId,
      });

      return void res.status(201).json({
        status: 'success',
        message: 'Landed cost allocation created successfully',
        data: allocation,
      });
    } catch (error) {
      handleError(res, error, 'Failed to create landed cost allocation');
    }
  }
);

/**
 * GET /api/v1/inventory/landed-costs
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: landedCostAllocationQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const result = await landedCostService.listAllocations(companyId, {
        branchId: req.query.branchId as string | undefined,
        invoiceId: req.query.invoiceId as string | undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        isCancelled: req.query.isCancelled as boolean | undefined,
        skip: req.query.skip as number | undefined,
        take: req.query.take as number | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: { total: result.total, skip: result.skip, take: result.take },
      });
    } catch (error) {
      handleError(res, error, 'Failed to list landed cost allocations');
    }
  }
);

/**
 * GET /api/v1/inventory/landed-costs/:id
 */
router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const allocation = await landedCostService.getAllocationById(companyId, req.params.id);
      return void res.json({ status: 'success', data: allocation });
    } catch (error) {
      handleError(res, error, 'Failed to get landed cost allocation');
    }
  }
);

/**
 * POST /api/v1/inventory/landed-costs/:id/post
 */
router.post(
  '/:id/post',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const result = await landedCostService.postAllocation(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, allocationId: req.params.id }, 'Landed cost allocation posted');

      return void res.json({
        status: 'success',
        message: 'Landed cost allocation posted successfully',
        data: result,
      });
    } catch (error) {
      handleError(res, error, 'Failed to post landed cost allocation');
    }
  }
);

/**
 * POST /api/v1/inventory/landed-costs/:id/unpost
 */
router.post(
  '/:id/unpost',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      await landedCostService.unpostAllocation(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, allocationId: req.params.id }, 'Landed cost allocation unposted');

      return void res.json({
        status: 'success',
        message: 'Landed cost allocation unposted successfully',
      });
    } catch (error) {
      handleError(res, error, 'Failed to unpost landed cost allocation');
    }
  }
);

/**
 * POST /api/v1/inventory/landed-costs/:id/cancel
 */
router.post(
  '/:id/cancel',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const allocation = await landedCostService.cancelAllocation(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Landed cost allocation cancelled successfully',
        data: allocation,
      });
    } catch (error) {
      handleError(res, error, 'Failed to cancel landed cost allocation');
    }
  }
);

export default router;
