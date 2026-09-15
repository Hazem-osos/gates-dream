import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { createSafeSchema, updateSafeSchema, safeQuerySchema } from '../schemas/safe.schema';
import { safeService } from '../services/safe.service';
import { ensureSafesFromChart } from '../services/cash-safe-sync';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { bankBoxRightsService } from '../../treasury/services/bank-box-rights.service';
import { companySettingsService } from '../../company/services/company-settings.service';

const router = Router();

/**
 * GET /api/v1/accounting/safes
 * List safes
 */
router.get(
  '/',
  authorize({ resource: 'safe', action: 'view' }),
  validate({ query: safeQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await ensureSafesFromChart(companyId);

      let allowedSafeIds: string[] | null | undefined;
      if (!isAdminRequest(req) && req.user?.sub) {
        allowedSafeIds = await bankBoxRightsService.listViewableSafeIds(
          companyId,
          req.user.sub
        );
      }

      const [safes, settings] = await Promise.all([
        safeService.getSafes(companyId, {
          isActive: req.query.isActive as boolean | undefined,
          allowedSafeIds,
          skipChartSync: true,
        }),
        companySettingsService.getCompanySettings(companyId).catch(() => null),
      ]);
      const digits = settings?.accountsGuideDigits ?? 0;

      return void res.json({
        status: 'success',
        data: safes.map((safe) => ({
          ...safe,
          glAccountCode: safe.glAccount?.code
            ? digits > 0
              ? safe.glAccount.code.padStart(digits, '0')
              : safe.glAccount.code
            : null,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Error listing safes');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list safes',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/safes/:id
 * Get safe by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'safe', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const safe = await safeService.getSafeById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: safe,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting safe');
      const status = error instanceof Error && error.message === 'Safe not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get safe',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/safes
 * Create safe
 */
router.post(
  '/',
  authorize({ resource: 'safe', action: 'edit' }),
  validate({ body: createSafeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const safe = await safeService.createSafe(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Safe created successfully',
        data: safe,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating safe');
      const status =
        error instanceof Error && error.message.includes('already exists') ? 400 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create safe',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/safes/:id
 * Update safe
 */
router.put(
  '/:id',
  authorize({ resource: 'safe', action: 'edit' }),
  validate({ body: updateSafeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const safe = await safeService.updateSafe(companyId, req.params.id, req.body);

      return void res.json({
        status: 'success',
        message: 'Safe updated successfully',
        data: safe,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error updating safe');
      const status =
        error instanceof Error && error.message === 'Safe not found'
          ? 404
          : error instanceof Error && error.message.includes('already exists')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update safe',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/safes/:id
 * Delete safe
 */
router.delete(
  '/:id',
  authorize({ resource: 'safe', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await safeService.deleteSafe(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Safe deleted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error deleting safe');
      const status = error instanceof Error && error.message === 'Safe not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete safe',
      });
    }
  }
);

export default router;

