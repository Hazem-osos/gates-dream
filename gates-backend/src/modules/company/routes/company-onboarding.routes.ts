import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AuthRequest } from '../../../shared/auth/types';
import { logger } from '../../../shared/logger';
import { onboardingSetupSchema } from '../schemas/company-onboarding.schema';
import { companyOnboardingService } from '../services/company-onboarding.service';
import { onboardingImportService } from '../services/onboarding-import.service';
import { z } from 'zod';

const router = Router({ mergeParams: true });

router.get('/status', authorize({ resource: 'company', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company context is required' });
    }
    const data = await companyOnboardingService.getStatus(companyId);
    return void res.json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'GET onboarding status failed');
    return void res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load onboarding status',
    });
  }
});

router.post(
  '/setup',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: onboardingSetupSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const data = await companyOnboardingService.runSetup(companyId, req.body);
      return void res.status(201).json({
        status: 'success',
        message: 'Onboarding completed',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'POST onboarding setup failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Onboarding setup failed',
      });
    }
  }
);

router.post(
  '/import',
  authorize({ resource: 'company', action: 'edit' }),
  validate({
    body: z.object({
      entity: z.enum(['CUSTOMERS', 'ITEMS']),
      rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))).min(1).max(500),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const { entity, rows } = req.body as {
        entity: 'CUSTOMERS' | 'ITEMS';
        rows: Record<string, string | number | null>[];
      };
      const data =
        entity === 'CUSTOMERS'
          ? await onboardingImportService.importCustomers(
              companyId,
              rows.map((r) => ({
                arabicName: String(r.arabicName ?? r.name ?? ''),
                mobile: r.mobile != null ? String(r.mobile) : undefined,
                code: r.code != null ? String(r.code) : undefined,
              }))
            )
          : await onboardingImportService.importItems(
              companyId,
              rows.map((r) => ({
                arabicName: String(r.arabicName ?? r.name ?? ''),
                serial: r.barcode != null ? String(r.barcode) : r.serial != null ? String(r.serial) : undefined,
                salesPrice: r.price != null ? Number(r.price) : r.salesPrice != null ? Number(r.salesPrice) : undefined,
                purchasePrice: r.purchasePrice != null ? Number(r.purchasePrice) : undefined,
              }))
            );
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
  '/complete',
  authorize({ resource: 'company', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const data = await companyOnboardingService.markComplete(companyId);
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status = error instanceof Error && error.message.includes('incomplete') ? 400 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to complete onboarding',
      });
    }
  }
);

export default router;
