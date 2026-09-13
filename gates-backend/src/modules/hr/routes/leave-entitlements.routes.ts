import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { leaveEntitlementsDisbursementSchema } from '../schemas/leave-entitlements.schema';
import { leaveEntitlementsService } from '../services/leave-entitlements.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/hr/leave-entitlements/disburse
 * Disburse annual leave entitlements to employee
 */
router.post(
  '/disburse',
  authorize({ resource: 'employee', action: 'edit' }),
  validate({ body: leaveEntitlementsDisbursementSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || '';

      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = {
        ...req.body,
        date:
          typeof req.body.date === 'string'
            ? new Date(req.body.date)
            : req.body.date,
      };

      const result = await leaveEntitlementsService.disburseLeaveEntitlements(
        companyId,
        userId,
        data
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Leave entitlements disbursed successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error disbursing leave entitlements');
      const status =
        error instanceof Error &&
        (error.message === 'Employee not found' ||
          error.message === 'Active contract not found for employee')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to disburse leave entitlements',
      });
    }
  }
);

/**
 * GET /api/v1/hr/leave-entitlements/history/:employeeId
 * Get leave entitlements history for an employee
 */
router.get(
  '/history/:employeeId',
  authorize({ resource: 'employee', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const year = req.query.year as string | undefined;

      const history = await leaveEntitlementsService.getLeaveEntitlementsHistory(
        companyId,
        req.params.employeeId,
        year
      );

      return void res.json({
        status: 'success',
        data: history,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting leave entitlements history');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get leave entitlements history',
      });
    }
  }
);

export default router;

