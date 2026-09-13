import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { licenseSubscriptionService } from '../services/license-subscription.service';
import {
  LICENSE_MODULE_CODES,
  SUBSCRIPTION_PLAN_TYPES,
  SUBSCRIPTION_STATUSES,
} from '../types/license-modules';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

const activateSchema = z.object({
  planType: z.enum(SUBSCRIPTION_PLAN_TYPES as unknown as [string, ...string[]]),
  status: z.enum(SUBSCRIPTION_STATUSES as unknown as [string, ...string[]]).optional(),
  startDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  allowedModules: z.array(z.enum(LICENSE_MODULE_CODES as unknown as [string, ...string[]])).min(1),
  maxBranches: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  maxStorageMb: z.number().int().positive().optional(),
  licenseKey: z.string().min(8).max(128).optional(),
});

router.get(
  '/current',
  authorize({ resource: 'company', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');
      const data = await licenseSubscriptionService.getCurrent(companyId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to load subscription',
      });
    }
  }
);

router.post(
  '/activate',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: activateSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const body = req.body as z.infer<typeof activateSchema>;
      const data = await licenseSubscriptionService.activate({
        companyId,
        planType: body.planType as 'LIFETIME' | 'SUBSCRIPTION',
        status: body.status as (typeof SUBSCRIPTION_STATUSES)[number] | undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        expiryDate:
          body.expiryDate === null
            ? null
            : body.expiryDate
              ? new Date(body.expiryDate)
              : undefined,
        allowedModules: body.allowedModules as (typeof LICENSE_MODULE_CODES)[number][],
        maxBranches: body.maxBranches,
        maxUsers: body.maxUsers,
        maxStorageMb: body.maxStorageMb,
        licenseKey: body.licenseKey,
      });

      return void res.json({ status: 'success', data, message: 'Subscription activated' });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Activation failed',
      });
    }
  }
);

export default router;
