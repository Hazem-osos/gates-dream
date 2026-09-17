import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  createSecuritiesReceiptSchema,
  updateSecuritiesReceiptSchema,
  bounceSecuritiesReceiptSchema,
  collectSecuritiesSchema,
  endorseSecuritiesReceiptSchema,
  securitiesReceiptQuerySchema,
} from '../schemas/securities-receipt.schema';
import { createBatchReceiptPapersSchema } from '../schemas/batch-receipt-paper.schema';
import { executeMultiCollectionSchema } from '../schemas/multi-collection.schema';
import { securitiesReceiptService } from '../services/securities-receipt.service';
import { commercialPaperService } from '../services/commercial-paper.service';
import { commercialPaperPostingService } from '../services/commercial-paper-posting.service';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.post(
  '/batch',
  authorize({ resource: 'securities-receipt', action: 'edit' }),
  validate({ body: createBatchReceiptPapersSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      const result = await commercialPaperService.createBatchReceiptPapersInTx(
        companyId,
        req.body,
        req.branchId
      );
      return void res.status(201).json({
        status: 'success',
        message: 'تم إنشاء أوراق القبض بنجاح',
        data: result,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating batch securities receipts');
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({ status: 'error', message: error.message });
      }
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create batch securities receipts',
      });
    }
  }
);

router.get('/', authorize({ resource: 'securities-receipt', action: 'view' }), validate({ query: securitiesReceiptQuerySchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const result = await securitiesReceiptService.getSecuritiesReceipts(companyId, {
      startDate: req.query.startDate as Date | undefined,
      endDate: req.query.endDate as Date | undefined,
      securityType: req.query.securityType as string | undefined,
      customerId: req.query.customerId as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
      isPosted: req.query.isPosted as boolean | undefined,
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
    });
    return void res.json({ status: 'success', data: result.receipts, pagination: result.pagination });
  } catch (error) {
    logger.error({ error }, 'Error listing securities receipts');
    return void res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to list securities receipts' });
  }
});

router.get('/:id', authorize({ resource: 'securities-receipt', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const receipt = await securitiesReceiptService.getSecuritiesReceiptById(companyId, req.params.id);
    return void res.json({ status: 'success', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error getting securities receipt');
    const status = error instanceof Error && error.message === 'Securities receipt not found' ? 404 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to get securities receipt' });
  }
});

router.post('/', authorize({ resource: 'securities-receipt', action: 'edit' }), validate({ body: createSecuritiesReceiptSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const receipt = await securitiesReceiptService.createSecuritiesReceipt(companyId, req.body, {
      branchId: req.branchId,
      userId: req.user?.sub || '',
    });
    return void res.status(201).json({ status: 'success', message: 'Securities receipt created successfully', data: receipt });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error creating securities receipt');
    const status = error instanceof Error && (error.message.includes('already exists') || error.message.includes('required')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to create securities receipt' });
  }
});

router.put('/:id', authorize({ resource: 'securities-receipt', action: 'edit' }), validate({ body: updateSecuritiesReceiptSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const receipt = await securitiesReceiptService.updateSecuritiesReceipt(companyId, req.params.id, req.body, {
      branchId: req.branchId,
      userId: req.user?.sub || '',
    });
    return void res.json({ status: 'success', message: 'Securities receipt updated successfully', data: receipt });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error updating securities receipt');
    const status = error instanceof Error && error.message === 'Securities receipt not found' ? 404 : error instanceof Error && (error.message.includes('already exists') || error.message.includes('Cannot update')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to update securities receipt' });
  }
});

router.post('/:id/post', authorize({ resource: 'securities-receipt', action: 'post' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const receipt = await securitiesReceiptService.postSecuritiesReceipt(companyId, req.params.id, {
      branchId: req.branchId,
      userId,
    });
    return void res.json({ status: 'success', message: 'Securities receipt posted successfully', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error posting securities receipt');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities receipt not found' ? 404 : error instanceof Error && error.message.includes('already') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to post securities receipt' });
  }
});

router.post('/:id/unpost', authorize({ resource: 'securities-receipt', action: 'post' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const receipt = await securitiesReceiptService.unpostSecuritiesReceipt(companyId, req.params.id, {
      branchId: req.branchId,
      userId,
    });
    return void res.json({ status: 'success', message: 'Securities receipt unposted successfully', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error unposting securities receipt');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities receipt not found' ? 404 : error instanceof Error && error.message.includes('not posted') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to unpost securities receipt' });
  }
});

router.post('/:id/multi-collect', authorize({ resource: 'securities-receipt', action: 'post' }), validate({ body: executeMultiCollectionSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await commercialPaperPostingService.executeMultiCollection(
      { companyId, branchId: req.branchId, userId: req.user?.sub || '' },
      'RECEIPT',
      req.params.id,
      req.body
    );
    return void res.json({ status: 'success', message: 'تم تأكيد التحصيل المتعدد', data });
  } catch (error) {
    logger.error({ error }, 'Error executing receipt multi-collection');
    const status = error instanceof AppError ? error.statusCode : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to execute multi-collection' });
  }
});

router.post('/:id/collect', authorize({ resource: 'securities-receipt', action: 'post' }), validate({ body: collectSecuritiesSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const receipt = await securitiesReceiptService.collectSecuritiesReceipt(
      companyId,
      req.params.id,
      { branchId: req.branchId, userId },
      req.body
    );
    return void res.json({ status: 'success', message: 'تم تحصيل ورقة المقبوضات', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error collecting securities receipt');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities receipt not found' ? 404 : error instanceof Error && error.message.includes('already') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to collect securities receipt' });
  }
});

router.post('/:id/bounce', authorize({ resource: 'securities-receipt', action: 'edit' }), validate({ body: bounceSecuritiesReceiptSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const receipt = await securitiesReceiptService.bounceSecuritiesReceipt(companyId, req.params.id, {
      branchId: req.branchId,
      userId,
    }, req.body);
    return void res.json({ status: 'success', message: 'Securities receipt bounced successfully', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error bouncing securities receipt');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities receipt not found' ? 404 : error instanceof Error && (error.message.includes('already') || error.message.includes('Cannot')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to bounce securities receipt' });
  }
});

router.post('/:id/endorse', authorize({ resource: 'securities-receipt', action: 'edit' }), validate({ body: endorseSecuritiesReceiptSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const receipt = await securitiesReceiptService.endorseSecuritiesReceipt(
      companyId,
      req.params.id,
      { branchId: req.branchId, userId: req.user?.sub || '' },
      req.body
    );
    return void res.json({ status: 'success', message: 'Securities receipt endorsed successfully', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error endorsing securities receipt');
    const status = error instanceof Error && error.message === 'Securities receipt not found' ? 404 : error instanceof Error && (error.message.includes('before') || error.message.includes('Cannot') || error.message.includes('not found')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to endorse securities receipt' });
  }
});

router.post('/:id/unendorse', authorize({ resource: 'securities-receipt', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const receipt = await securitiesReceiptService.unendorseSecuritiesReceipt(companyId, req.params.id, {
      branchId: req.branchId,
      userId: req.user?.sub || '',
    });
    return void res.json({ status: 'success', message: 'تم فك تظهير الورقة', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error unendorsing securities receipt');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities receipt not found' ? 404 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to unendorse securities receipt' });
  }
});

router.post('/:id/cancel', authorize({ resource: 'securities-receipt', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const receipt = await securitiesReceiptService.cancelSecuritiesReceipt(companyId, req.params.id);
    return void res.json({ status: 'success', message: 'Securities receipt cancelled successfully', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error cancelling securities receipt');
    const status = error instanceof Error && error.message === 'Securities receipt not found' ? 404 : error instanceof Error && error.message.includes('already') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to cancel securities receipt' });
  }
});

router.post('/:id/restore', authorize({ resource: 'securities-receipt', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const receipt = await securitiesReceiptService.restoreSecuritiesReceipt(companyId, req.params.id, {
      branchId: req.branchId,
      userId: req.user?.sub || '',
    });
    return void res.json({ status: 'success', message: 'Securities receipt restored successfully', data: receipt });
  } catch (error) {
    logger.error({ error }, 'Error restoring securities receipt');
    const status = error instanceof Error && error.message === 'Securities receipt not found' ? 404 : error instanceof Error && error.message.includes('not cancelled') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to restore securities receipt' });
  }
});

export default router;
