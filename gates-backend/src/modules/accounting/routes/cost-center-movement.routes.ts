import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  transferCostCenterMovementSchema,
  costCenterMovementSummarySchema,
} from '../schemas/cost-center-movement.schema';
import { costCenterMovementService } from '../services/cost-center-movement.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/accounting/cost-center-movements/transfer
 * Transfer cost center movements from one cost center to another
 */
router.post(
  '/transfer',
  authorize({ resource: 'cost-center-movement', action: 'edit' }),
  validate({ body: transferCostCenterMovementSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || 'system';
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result =
        await costCenterMovementService.transferCostCenterMovement(
          companyId,
          userId,
          req.body
        );

      logger.info(
        { companyId, userId, result },
        'Cost center movement transfer completed'
      );

      return void res.json({
        status: 'success',
        message: 'Cost center movement transferred successfully',
        data: result,
      });
    } catch (error) {
      logger.error(
        { error, body: req.body },
        'Error transferring cost center movement'
      );
      const status =
        error instanceof Error &&
        (error.message === 'From cost center not found' ||
          error.message === 'To cost center not found' ||
          error.message === 'Account not found' ||
          error.message ===
            'From cost center and to cost center cannot be the same' ||
          error.message === 'From date must be before or equal to to date' ||
          error.message ===
            'No cost center movements found for the specified criteria and date range')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to transfer cost center movement',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/cost-center-movements/summary
 * Get cost center movement summary
 */
router.get(
  '/summary',
  authorize({ resource: 'cost-center-movement', action: 'view' }),
  validate({ query: costCenterMovementSummarySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const parsed = req.query as {
        costCenterId?: string;
        fromDate?: Date | string;
        toDate?: Date | string;
        accountId?: string;
      };
      const fromDate = parsed.fromDate instanceof Date ? parsed.fromDate : new Date(String(parsed.fromDate ?? ''));
      const toDate = parsed.toDate instanceof Date ? parsed.toDate : new Date(String(parsed.toDate ?? ''));

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return void res.status(400).json({
          status: 'error',
          message: 'Invalid date format. Use ISO 8601 format (e.g., 2025-01-15)',
        });
      }

      const result =
        await costCenterMovementService.getCostCenterMovementSummary(
          companyId,
          String(parsed.costCenterId),
          fromDate,
          toDate,
          parsed.accountId
        );

      return void res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cost center movement summary');
      const status =
        error instanceof Error &&
        error.message === 'Cost center not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get cost center movement summary',
      });
    }
  }
);

export default router;
