import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import type { AuthRequest } from '../../../shared/auth/types';
import { realEstateAccountResolverService } from '../services/real-estate-account-resolver.service';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/real-estate/settings
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const data = await realEstateAccountResolverService.getSettings(companyId);
      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'Error loading real-estate settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر تحميل إعدادات العقارات',
      });
    }
  }
);

/**
 * PUT /api/v1/real-estate/settings
 */
router.put(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }

      const body = req.body as {
        realEstateArAccountCode?: string | null;
        unearnedRealEstateRevenueAccountCode?: string | null;
        realEstateRevenueAccountCode?: string | null;
        maintenanceDepositsAccountCode?: string | null;
        penaltyRevenueAccountCode?: string | null;
      };

      const trimOrNull = (v: unknown) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        const s = String(v).trim();
        return s.length ? s : null;
      };

      await realEstateAccountResolverService.getSettings(companyId);
      const data = await prisma.realEstateSettings.update({
        where: { companyId },
        data: {
          ...(body.realEstateArAccountCode !== undefined
            ? { realEstateArAccountCode: trimOrNull(body.realEstateArAccountCode) }
            : {}),
          ...(body.unearnedRealEstateRevenueAccountCode !== undefined
            ? {
                unearnedRealEstateRevenueAccountCode: trimOrNull(
                  body.unearnedRealEstateRevenueAccountCode
                ),
              }
            : {}),
          ...(body.realEstateRevenueAccountCode !== undefined
            ? { realEstateRevenueAccountCode: trimOrNull(body.realEstateRevenueAccountCode) }
            : {}),
          ...(body.maintenanceDepositsAccountCode !== undefined
            ? { maintenanceDepositsAccountCode: trimOrNull(body.maintenanceDepositsAccountCode) }
            : {}),
          ...(body.penaltyRevenueAccountCode !== undefined
            ? { penaltyRevenueAccountCode: trimOrNull(body.penaltyRevenueAccountCode) }
            : {}),
        },
      });

      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'Error updating real-estate settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر حفظ إعدادات العقارات',
      });
    }
  }
);

export default router;
