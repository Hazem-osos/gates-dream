import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  tenantAndFiscalContextMiddleware,
  requirePostingContext,
} from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  createTreasuryReceiptSchema,
  updateTreasuryReceiptSchema,
  treasuryReceiptQuerySchema,
} from '../schemas/treasury-receipt.schema';
import { treasuryReceiptService } from '../services/treasury-receipt.service';
import { buildTreasuryPostingContext } from '../../treasury/services/treasury-posting-context';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

/**
 * GET /api/v1/accounting/treasury-receipts
 * List treasury receipts
 */
router.get(
  '/',
  authorize({ resource: 'treasury-receipt', action: 'view' }),
  validate({ query: treasuryReceiptQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await treasuryReceiptService.getTreasuryReceipts(companyId, {
        startDate: req.query.startDate as Date | undefined,
        endDate: req.query.endDate as Date | undefined,
        receiptType: req.query.receiptType as string | undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.receipts,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing treasury receipts');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list treasury receipts',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/treasury-receipts/:id
 * Get treasury receipt by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'treasury-receipt', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await treasuryReceiptService.getTreasuryReceiptById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting treasury receipt');
      const status =
        error instanceof Error && error.message === 'Treasury receipt not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get treasury receipt',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/treasury-receipts
 * Create treasury receipt
 */
router.post(
  '/',
  authorize({ resource: 'treasury-receipt', action: 'edit' }),
  validate({ body: createTreasuryReceiptSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || 'system';
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await treasuryReceiptService.createTreasuryReceipt(
        companyId,
        userId,
        req.body
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Treasury receipt created successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating treasury receipt');
      const status =
        error instanceof Error && error.message.includes('already exists')
          ? 400
          : error instanceof Error && error.message.includes('required')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create treasury receipt',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/treasury-receipts/:id
 * Update treasury receipt
 */
router.put(
  '/:id',
  authorize({ resource: 'treasury-receipt', action: 'edit' }),
  validate({ body: updateTreasuryReceiptSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await treasuryReceiptService.updateTreasuryReceipt(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Treasury receipt updated successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error updating treasury receipt');
      const status =
        error instanceof Error && error.message === 'Treasury receipt not found'
          ? 404
          : error instanceof Error &&
              (error.message.includes('already exists') ||
                error.message.includes('Cannot update'))
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update treasury receipt',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/treasury-receipts/:id/post
 * Post treasury receipt
 */
router.post(
  '/:id/post',
  tenantAndFiscalContextMiddleware,
  requirePostingContext,
  authorize({ resource: 'treasury-receipt', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildTreasuryPostingContext(req);
      const receipt = await treasuryPostingService.postFromTreasuryReceipt(
        ctx,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Treasury receipt posted successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error posting treasury receipt');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error && error.message === 'Treasury receipt not found'
            ? 404
            : error instanceof Error && error.message.includes('already')
              ? 400
              : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to post treasury receipt',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/treasury-receipts/:id/unpost
 * Unpost treasury receipt
 */
router.post(
  '/:id/unpost',
  tenantAndFiscalContextMiddleware,
  requirePostingContext,
  authorize({ resource: 'treasury-receipt', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildTreasuryPostingContext(req);
      const receipt = await treasuryPostingService.unpostFromTreasuryReceipt(
        ctx,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Treasury receipt unposted successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting treasury receipt');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error && error.message === 'Treasury receipt not found'
            ? 404
            : error instanceof Error && error.message.includes('not posted')
              ? 400
              : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to unpost treasury receipt',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/treasury-receipts/:id/cancel
 * Cancel treasury receipt
 */
router.post(
  '/:id/cancel',
  authorize({ resource: 'treasury-receipt', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await treasuryReceiptService.cancelTreasuryReceipt(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Treasury receipt cancelled successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling treasury receipt');
      const status =
        error instanceof Error && error.message === 'Treasury receipt not found'
          ? 404
          : error instanceof Error && error.message.includes('already')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to cancel treasury receipt',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/treasury-receipts/:id/restore
 * Restore cancelled treasury receipt
 */
router.post(
  '/:id/restore',
  authorize({ resource: 'treasury-receipt', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await treasuryReceiptService.restoreTreasuryReceipt(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Treasury receipt restored successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring treasury receipt');
      const status =
        error instanceof Error && error.message === 'Treasury receipt not found'
          ? 404
          : error instanceof Error && error.message.includes('not cancelled')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to restore treasury receipt',
      });
    }
  }
);

export default router;

