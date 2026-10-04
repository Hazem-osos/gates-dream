import { Router, Response, NextFunction } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createIssueSchema,
  issueQuerySchema,
} from '../schemas/issue.schema';
import { issueService } from '../services/issue.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';
import { stockPostJson } from '../utils/stock-post-route-response';
import { resolveStockListPaging } from '../utils/stock-list-query';
import { stockMutationMessage, stockMutationStatus } from '../utils/stock-route-error';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/issues
 * Create issue entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createIssueSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const issue = await issueService.createIssue(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        hijriDate: req.body.hijriDate,
        record: req.body.record,
        warehouseId: req.body.warehouseId,
        customerId: req.body.customerId || undefined,
        lines: req.body.lines,
      });

      logger.info(
        { companyId, issueId: issue.id },
        'Issue created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'تم حفظ إذن الصرف',
        data: issue,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating issue');
      return void res.status(stockMutationStatus(error)).json({
        status: 'error',
        message: stockMutationMessage(error, 'تعذّر حفظ إذن الصرف'),
      });
    }
  }
);

/**
 * GET /api/v1/inventory/issues
 * List issue entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: issueQuerySchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const query = req.query as unknown as {
        branchId?: string;
        warehouseId?: string;
        isPosted?: boolean;
        isApproved?: boolean;
        isCancelled?: boolean;
        fromDate?: string;
        toDate?: string;
        search?: string;
        page?: number;
        limit?: number;
        skip?: number;
        take?: number;
      };
      const { skip, take } = resolveStockListPaging(query);

      const result = await issueService.listIssues(companyId, {
        branchId: query.branchId,
        warehouseId: query.warehouseId,
        isPosted: query.isPosted,
        isApproved: query.isApproved,
        isCancelled: query.isCancelled,
        fromDate: query.fromDate,
        toDate: query.toDate,
        search: query.search,
        skip,
        take,
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
      next(error);
    }
  }
);

/**
 * GET /api/v1/inventory/issues/:id
 * Get issue by ID
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
          message: 'معرّف الشركة مطلوب',
        });
      }

      const issue = await issueService.getIssueById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: issue,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting issue');
      const status =
        error instanceof Error && error.message === 'Issue not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get issue',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createIssueSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      const issue = await issueService.updateIssue(companyId, req.params.id, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        hijriDate: req.body.hijriDate,
        record: req.body.record,
        warehouseId: req.body.warehouseId,
        customerId: req.body.customerId || undefined,
        lines: req.body.lines,
      });
      return void res.json({ status: 'success', message: 'تم حفظ السند', data: issue });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تعديل السند';
      const status = message.includes('not found') || message.includes('لا يمكن') || message.includes('غير') ? 400 : 500;
      return void res.status(status).json({ status: 'error', message });
    }
  }
);

router.delete('/:id', authorize({ resource: 'invoice', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    await issueService.deleteIssue(companyId, req.params.id);
    return void res.json({ status: 'success', message: 'تم حذف السند' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر حذف السند';
    const status = message.includes('not found') || message.includes('لا يمكن') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message });
  }
});

/**
 * POST /api/v1/inventory/issues/:id/post
 * Post issue (remove quantities from warehouse)
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
          message: 'معرّف الشركة مطلوب',
        });
      }

      const result = await issueService.postIssue(
        companyId,
        req.params.id,
        buildStockGlPostingContext(req, companyId)
      );

      logger.info({ companyId, issueId: req.params.id }, 'Issue posted');

      return void res.json(stockPostJson(result, 'تم ترحيل الصرف بنجاح'));
    } catch (error) {
      logger.error({ error }, 'Error posting issue');
      return void res.status(stockMutationStatus(error)).json({
        status: 'error',
        message: stockMutationMessage(error, 'تعذّر ترحيل إذن الصرف'),
      });
    }
  }
);

/**
 * POST /api/v1/inventory/issues/:id/unpost
 * Unpost issue (reverse quantity removals)
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
          message: 'معرّف الشركة مطلوب',
        });
      }

      await issueService.unpostIssue(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, issueId: req.params.id }, 'Issue unposted');

      return void res.json({
        status: 'success',
        message: 'Issue unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting issue');
      const status =
        error instanceof Error &&
        (error.message === 'Issue not found' ||
          error.message.includes('not posted') ||
          error.message.includes('Cannot unpost'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unpost issue',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/issues/:id/cancel
 * Cancel issue
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
          message: 'معرّف الشركة مطلوب',
        });
      }

      const issue = await issueService.cancelIssue(
        companyId,
        req.params.id
      );

      logger.info({ companyId, issueId: req.params.id }, 'Issue cancelled');

      return void res.json({
        status: 'success',
        message: 'Issue cancelled successfully',
        data: issue,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling issue');
      const status =
        error instanceof Error &&
        (error.message === 'Issue not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel issue',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/issues/:id/restore
 * Restore cancelled issue
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
          message: 'معرّف الشركة مطلوب',
        });
      }

      const issue = await issueService.restoreIssue(
        companyId,
        req.params.id
      );

      logger.info({ companyId, issueId: req.params.id }, 'Issue restored');

      return void res.json({
        status: 'success',
        message: 'Issue restored successfully',
        data: issue,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring issue');
      const status =
        error instanceof Error &&
        (error.message === 'Issue not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore issue',
      });
    }
  }
);

export default router;

