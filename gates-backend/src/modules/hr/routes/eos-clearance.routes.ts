import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { eosClearanceSchema } from '../schemas/eos-clearance.schema';
import { eosClearanceService } from '../services/eos-clearance.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/hr/eos-clearance/clear
 * Clear end of service entitlements for an employee
 */
router.post(
  '/clear',
  authorize({ resource: 'employee', action: 'edit' }),
  validate({ body: eosClearanceSchema }),
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
        clearanceDate:
          typeof req.body.clearanceDate === 'string'
            ? new Date(req.body.clearanceDate)
            : req.body.clearanceDate,
      };

      const result = await eosClearanceService.clearEOSEntitlements(
        companyId,
        userId,
        data
      );

      return void res.status(201).json({
        status: 'success',
        message: 'EOS entitlements cleared successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error clearing EOS entitlements');
      const status =
        error instanceof Error &&
        (error.message === 'Employee not found' ||
          error.message === 'Active contract not found for employee' ||
          error.message === 'Account not found')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to clear EOS entitlements',
      });
    }
  }
);

/**
 * GET /api/v1/hr/eos-clearance/history/:employeeId
 * Get EOS clearance history for an employee
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

      const history = await eosClearanceService.getEOSClearanceHistory(
        companyId,
        req.params.employeeId
      );

      return void res.json({
        status: 'success',
        data: history,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting EOS clearance history');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get EOS clearance history',
      });
    }
  }
);

export default router;

