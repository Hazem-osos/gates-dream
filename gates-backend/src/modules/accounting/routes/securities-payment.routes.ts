import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  createSecuritiesPaymentSchema,
  updateSecuritiesPaymentSchema,
  bounceSecuritiesPaymentSchema,
  securitiesPaymentQuerySchema,
} from '../schemas/securities-payment.schema';
import { collectSecuritiesSchema } from '../schemas/securities-receipt.schema';
import { executeMultiCollectionSchema } from '../schemas/multi-collection.schema';
import { securitiesPaymentService } from '../services/securities-payment.service';
import { commercialPaperPostingService } from '../services/commercial-paper-posting.service';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.get('/', authorize({ resource: 'securities-payment', action: 'view' }), validate({ query: securitiesPaymentQuerySchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const result = await securitiesPaymentService.getSecuritiesPayments(companyId, {
      startDate: req.query.startDate as Date | undefined,
      endDate: req.query.endDate as Date | undefined,
      securityType: req.query.securityType as string | undefined,
      customerId: req.query.customerId as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
      isPosted: req.query.isPosted as boolean | undefined,
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
    });
    return void res.json({ status: 'success', data: result.payments, pagination: result.pagination });
  } catch (error) {
    logger.error({ error }, 'Error listing securities payments');
    return void res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to list securities payments' });
  }
});

router.get('/:id', authorize({ resource: 'securities-payment', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const payment = await securitiesPaymentService.getSecuritiesPaymentById(companyId, req.params.id);
    return void res.json({ status: 'success', data: payment });
  } catch (error) {
    logger.error({ error }, 'Error getting securities payment');
    const status = error instanceof Error && error.message === 'Securities payment not found' ? 404 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to get securities payment' });
  }
});

router.post('/', authorize({ resource: 'securities-payment', action: 'edit' }), validate({ body: createSecuritiesPaymentSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const payment = await securitiesPaymentService.createSecuritiesPayment(companyId, req.body, {
      branchId: req.branchId,
      userId: req.user?.sub || '',
    });
    return void res.status(201).json({ status: 'success', message: 'Securities payment created successfully', data: payment });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error creating securities payment');
    const status = error instanceof Error && (error.message.includes('already exists') || error.message.includes('required')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to create securities payment' });
  }
});

router.put('/:id', authorize({ resource: 'securities-payment', action: 'edit' }), validate({ body: updateSecuritiesPaymentSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const payment = await securitiesPaymentService.updateSecuritiesPayment(companyId, req.params.id, req.body, {
      branchId: req.branchId,
      userId: req.user?.sub || '',
    });
    return void res.json({ status: 'success', message: 'Securities payment updated successfully', data: payment });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error updating securities payment');
    const status = error instanceof Error && error.message === 'Securities payment not found' ? 404 : error instanceof Error && (error.message.includes('already exists') || error.message.includes('Cannot update')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to update securities payment' });
  }
});

router.post('/:id/post', authorize({ resource: 'securities-payment', action: 'post' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const payment = await securitiesPaymentService.postSecuritiesPayment(companyId, req.params.id, {
      branchId: req.branchId,
      userId,
    });
    return void res.json({ status: 'success', message: 'Securities payment posted successfully', data: payment });
  } catch (error) {
    logger.error({ error }, 'Error posting securities payment');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities payment not found' ? 404 : error instanceof Error && error.message.includes('already') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to post securities payment' });
  }
});

router.post('/:id/unpost', authorize({ resource: 'securities-payment', action: 'post' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const payment = await securitiesPaymentService.unpostSecuritiesPayment(companyId, req.params.id, {
      branchId: req.branchId,
      userId,
    });
    return void res.json({ status: 'success', message: 'Securities payment unposted successfully', data: payment });
  } catch (error) {
    logger.error({ error }, 'Error unposting securities payment');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities payment not found' ? 404 : error instanceof Error && error.message.includes('not posted') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to unpost securities payment' });
  }
});

router.post('/:id/multi-collect', authorize({ resource: 'securities-payment', action: 'post' }), validate({ body: executeMultiCollectionSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await commercialPaperPostingService.executeMultiCollection(
      { companyId, branchId: req.branchId, userId: req.user?.sub || '' },
      'PAYMENT',
      req.params.id,
      req.body
    );
    return void res.json({ status: 'success', message: 'تم تأكيد التحصيل المتعدد', data });
  } catch (error) {
    logger.error({ error }, 'Error executing payment multi-collection');
    const status = error instanceof AppError ? error.statusCode : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to execute multi-collection' });
  }
});

router.post('/:id/collect', authorize({ resource: 'securities-payment', action: 'post' }), validate({ body: collectSecuritiesSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const payment = await securitiesPaymentService.collectSecuritiesPayment(
      companyId,
      req.params.id,
      { branchId: req.branchId, userId },
      req.body
    );
    return void res.json({ status: 'success', message: 'تم تحصيل ورقة المدفوعات', data: payment });
  } catch (error) {
    logger.error({ error }, 'Error collecting securities payment');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities payment not found' ? 404 : error instanceof Error && error.message.includes('already') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to collect securities payment' });
  }
});

router.post('/:id/bounce', authorize({ resource: 'securities-payment', action: 'edit' }), validate({ body: bounceSecuritiesPaymentSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const payment = await securitiesPaymentService.bounceSecuritiesPayment(companyId, req.params.id, {
      branchId: req.branchId,
      userId,
    }, req.body);
    return void res.json({ status: 'success', message: 'Securities payment bounced successfully', data: payment });
  } catch (error) {
    logger.error({ error }, 'Error bouncing securities payment');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities payment not found' ? 404 : error instanceof Error && (error.message.includes('already') || error.message.includes('Cannot')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to bounce securities payment' });
  }
});

router.post('/:id/cancel', authorize({ resource: 'securities-payment', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const payment = await securitiesPaymentService.cancelSecuritiesPayment(companyId, req.params.id);
    return void res.json({ status: 'success', message: 'Securities payment cancelled successfully', data: payment });
  } catch (error) {
    logger.error({ error }, 'Error cancelling securities payment');
    const status = error instanceof Error && error.message === 'Securities payment not found' ? 404 : error instanceof Error && error.message.includes('already') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to cancel securities payment' });
  }
});

router.post('/:id/restore', authorize({ resource: 'securities-payment', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const payment = await securitiesPaymentService.restoreSecuritiesPayment(companyId, req.params.id, {
      branchId: req.branchId,
      userId: req.user?.sub || '',
    });
    return void res.json({ status: 'success', message: 'Securities payment restored successfully', data: payment });
  } catch (error) {
    logger.error({ error }, 'Error restoring securities payment');
    const status = error instanceof Error && error.message === 'Securities payment not found' ? 404 : error instanceof Error && error.message.includes('not cancelled') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to restore securities payment' });
  }
});

export default router;
