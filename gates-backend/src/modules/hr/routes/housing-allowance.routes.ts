import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { housingAllowanceClearanceSchema } from '../schemas/housing-allowance.schema';
import { housingAllowanceService } from '../services/housing-allowance.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/hr/housing-allowance/clear
 * Clear housing allowance for an employee
 */
router.post(
  '/clear',
  authorize({ resource: 'employee', action: 'edit' }),
  validate({ body: housingAllowanceClearanceSchema }),
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

      const result = await housingAllowanceService.clearHousingAllowance(
        companyId,
        userId,
        data
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Housing allowance cleared successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error clearing housing allowance');
      const status =
        error instanceof Error &&
        (error.message === 'Employee not found' ||
          error.message === 'Active contract not found for employee' ||
          error.message === 'Account not found' ||
          error.message === 'Housing allowance already cleared for this period')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to clear housing allowance',
      });
    }
  }
);

/**
 * GET /api/v1/hr/housing-allowance/history/:employeeId
 * Get housing allowance clearance history for an employee
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

      const periodYear = req.query.periodYear as string | undefined;
      const periodMonth = req.query.periodMonth as string | undefined;

      const history = await housingAllowanceService.getHousingAllowanceHistory(
        companyId,
        req.params.employeeId,
        periodYear,
        periodMonth
      );

      return void res.json({
        status: 'success',
        data: history,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting housing allowance history');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get housing allowance history',
      });
    }
  }
);

export default router;

