import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  createSecuritiesRenewalSchema,
  updateSecuritiesRenewalSchema,
  securitiesRenewalQuerySchema,
} from '../schemas/securities-renewal.schema';
import { securitiesRenewalService } from '../services/securities-renewal.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';

const router = Router();

router.get('/', authorize({ resource: 'securities-renewal', action: 'view' }), validate({ query: securitiesRenewalQuerySchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const result = await securitiesRenewalService.getSecuritiesRenewals(companyId, {
      startDate: req.query.startDate as Date | undefined,
      endDate: req.query.endDate as Date | undefined,
      isPosted: req.query.isPosted as boolean | undefined,
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
    });
    return void res.json({ status: 'success', data: result.renewals, pagination: result.pagination });
  } catch (error) {
    logger.error({ error }, 'Error listing securities renewals');
    return void res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to list securities renewals' });
  }
});

router.get('/:id', authorize({ resource: 'securities-renewal', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const renewal = await securitiesRenewalService.getSecuritiesRenewalById(companyId, req.params.id);
    return void res.json({ status: 'success', data: renewal });
  } catch (error) {
    logger.error({ error }, 'Error getting securities renewal');
    const status = error instanceof Error && error.message === 'Securities renewal not found' ? 404 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to get securities renewal' });
  }
});

router.post('/', authorize({ resource: 'securities-renewal', action: 'edit' }), validate({ body: createSecuritiesRenewalSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const renewal = await securitiesRenewalService.createSecuritiesRenewal(companyId, req.body);
    return void res.status(201).json({ status: 'success', message: 'Securities renewal created successfully', data: renewal });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error creating securities renewal');
    const status = error instanceof Error && (error.message.includes('already exists') || error.message.includes('not found')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to create securities renewal' });
  }
});

router.put('/:id', authorize({ resource: 'securities-renewal', action: 'edit' }), validate({ body: updateSecuritiesRenewalSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const renewal = await securitiesRenewalService.updateSecuritiesRenewal(companyId, req.params.id, req.body);
    return void res.json({ status: 'success', message: 'Securities renewal updated successfully', data: renewal });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error updating securities renewal');
    const status = error instanceof Error && error.message === 'Securities renewal not found' ? 404 : error instanceof Error && (error.message.includes('already exists') || error.message.includes('Cannot update')) ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to update securities renewal' });
  }
});

router.post('/:id/post', authorize({ resource: 'securities-renewal', action: 'post' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const renewal = await securitiesRenewalService.postSecuritiesRenewal(companyId, req.params.id, {
      branchId: req.branchId,
      userId,
    });
    return void res.json({ status: 'success', message: 'Securities renewal posted successfully', data: renewal });
  } catch (error) {
    logger.error({ error }, 'Error posting securities renewal');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities renewal not found' ? 404 : error instanceof Error && error.message.includes('already') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to post securities renewal' });
  }
});

router.post('/:id/unpost', authorize({ resource: 'securities-renewal', action: 'post' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const userId = req.user?.sub || '';
    const renewal = await securitiesRenewalService.unpostSecuritiesRenewal(companyId, req.params.id, {
      branchId: req.branchId,
      userId,
    });
    return void res.json({ status: 'success', message: 'Securities renewal unposted successfully', data: renewal });
  } catch (error) {
    logger.error({ error }, 'Error unposting securities renewal');
    const status = error instanceof AppError ? error.statusCode : error instanceof Error && error.message === 'Securities renewal not found' ? 404 : error instanceof Error && error.message.includes('not posted') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to unpost securities renewal' });
  }
});

router.post('/:id/cancel', authorize({ resource: 'securities-renewal', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const renewal = await securitiesRenewalService.cancelSecuritiesRenewal(companyId, req.params.id);
    return void res.json({ status: 'success', message: 'Securities renewal cancelled successfully', data: renewal });
  } catch (error) {
    logger.error({ error }, 'Error cancelling securities renewal');
    const status = error instanceof Error && error.message === 'Securities renewal not found' ? 404 : error instanceof Error && error.message.includes('already') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to cancel securities renewal' });
  }
});

router.post('/:id/restore', authorize({ resource: 'securities-renewal', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const renewal = await securitiesRenewalService.restoreSecuritiesRenewal(companyId, req.params.id);
    return void res.json({ status: 'success', message: 'Securities renewal restored successfully', data: renewal });
  } catch (error) {
    logger.error({ error }, 'Error restoring securities renewal');
    const status = error instanceof Error && error.message === 'Securities renewal not found' ? 404 : error instanceof Error && error.message.includes('not cancelled') ? 400 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'Failed to restore securities renewal' });
  }
});

export default router;
