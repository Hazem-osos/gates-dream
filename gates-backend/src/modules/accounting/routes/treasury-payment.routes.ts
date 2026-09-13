import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  tenantAndFiscalContextMiddleware,
  requirePostingContext,
} from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  createTreasuryPaymentSchema,
  updateTreasuryPaymentSchema,
  treasuryPaymentQuerySchema,
} from '../schemas/treasury-payment.schema';
import { treasuryPaymentService } from '../services/treasury-payment.service';
import { buildTreasuryPostingContext } from '../../treasury/services/treasury-posting-context';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.get(
  '/',
  authorize({ resource: 'treasury-payment', action: 'view' }),
  validate({ query: treasuryPaymentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await treasuryPaymentService.getTreasuryPayments(companyId, {
        startDate: req.query.startDate as Date | undefined,
        endDate: req.query.endDate as Date | undefined,
        paymentType: req.query.paymentType as string | undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.payments,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing treasury payments');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list treasury payments',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'treasury-payment', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const payment = await treasuryPaymentService.getTreasuryPaymentById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: payment,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting treasury payment');
      const status =
        error instanceof Error && error.message === 'Treasury payment not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get treasury payment',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'treasury-payment', action: 'edit' }),
  validate({ body: createTreasuryPaymentSchema }),
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

      const payment = await treasuryPaymentService.createTreasuryPayment(
        companyId,
        userId,
        req.body
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Treasury payment created successfully',
        data: payment,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating treasury payment');
      const status =
        error instanceof Error && error.message.includes('already exists')
          ? 400
          : error instanceof Error && error.message.includes('required')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create treasury payment',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'treasury-payment', action: 'edit' }),
  validate({ body: updateTreasuryPaymentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const payment = await treasuryPaymentService.updateTreasuryPayment(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Treasury payment updated successfully',
        data: payment,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error updating treasury payment');
      const status =
        error instanceof Error && error.message === 'Treasury payment not found'
          ? 404
          : error instanceof Error &&
              (error.message.includes('already exists') || error.message.includes('Cannot update'))
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update treasury payment',
      });
    }
  }
);

router.post(
  '/:id/post',
  tenantAndFiscalContextMiddleware,
  requirePostingContext,
  authorize({ resource: 'treasury-payment', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildTreasuryPostingContext(req);
      const payment = await treasuryPostingService.postFromTreasuryPayment(
        ctx,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Treasury payment posted successfully',
        data: payment,
      });
    } catch (error) {
      logger.error({ error }, 'Error posting treasury payment');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error && error.message === 'Treasury payment not found'
            ? 404
            : error instanceof Error && error.message.includes('already')
              ? 400
              : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to post treasury payment',
      });
    }
  }
);

router.post(
  '/:id/unpost',
  tenantAndFiscalContextMiddleware,
  requirePostingContext,
  authorize({ resource: 'treasury-payment', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildTreasuryPostingContext(req);
      const payment = await treasuryPostingService.unpostFromTreasuryPayment(
        ctx,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Treasury payment unposted successfully',
        data: payment,
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting treasury payment');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error && error.message === 'Treasury payment not found'
            ? 404
            : error instanceof Error && error.message.includes('not posted')
              ? 400
              : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to unpost treasury payment',
      });
    }
  }
);

router.post(
  '/:id/cancel',
  authorize({ resource: 'treasury-payment', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const payment = await treasuryPaymentService.cancelTreasuryPayment(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Treasury payment cancelled successfully',
        data: payment,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling treasury payment');
      const status =
        error instanceof Error && error.message === 'Treasury payment not found'
          ? 404
          : error instanceof Error && error.message.includes('already')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to cancel treasury payment',
      });
    }
  }
);

router.post(
  '/:id/restore',
  authorize({ resource: 'treasury-payment', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const payment = await treasuryPaymentService.restoreTreasuryPayment(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Treasury payment restored successfully',
        data: payment,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring treasury payment');
      const status =
        error instanceof Error && error.message === 'Treasury payment not found'
          ? 404
          : error instanceof Error && error.message.includes('not cancelled')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to restore treasury payment',
      });
    }
  }
);

export default router;

