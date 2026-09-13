import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AuthRequest } from '../../../shared/auth/types';
import { logger } from '../../../shared/logger';
import {
  bootstrapSchema,
  importExcelSchema,
  launchChecklistSchema,
} from '../schemas/onboarding.schema';
import { companyBootstrapService } from '../services/company-bootstrap.service';
import { dataImportService } from '../services/data-import.service';
import { onboardingStateService } from '../services/onboarding-state.service';
import { retireWelcomeTourNotification } from '../../notifications/services/onboarding-welcome-notification.service';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get('/status', authorize({ resource: 'company', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company context is required' });
    }
    const data = await onboardingStateService.getState(companyId);
    if (data.isOnboarded) {
      await retireWelcomeTourNotification(companyId);
    }
    return void res.json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'GET /onboarding/status failed');
    return void res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load onboarding state',
    });
  }
});

router.post(
  '/bootstrap',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: bootstrapSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const data = await companyBootstrapService.bootstrap(companyId, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'POST /onboarding/bootstrap failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Bootstrap failed',
      });
    }
  }
);

router.post(
  '/import-excel',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: importExcelSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const data = await dataImportService.importExcel(companyId, req.body);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Import failed',
      });
    }
  }
);

router.post(
  '/seed-demo',
  authorize({ resource: 'company', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const data = await onboardingStateService.seedDemoData(companyId);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Demo seed failed',
      });
    }
  }
);

router.post(
  '/complete-tour',
  authorize({ resource: 'company', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const data = await onboardingStateService.completeTour(companyId);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to complete tour',
      });
    }
  }
);

router.patch(
  '/launch-checklist',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: launchChecklistSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const data = await onboardingStateService.patchLaunchChecklist(companyId, req.body);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update checklist',
      });
    }
  }
);

router.patch(
  '/step',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: z.object({ step: z.number().int().min(1).max(5) }) }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      await onboardingStateService.updateStep(companyId, req.body.step);
      return void res.json({ status: 'success', data: { step: req.body.step } });
    } catch (error) {
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update step',
      });
    }
  }
);

export default router;
