import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  transferAccountMovementSchema,
  accountMovementSummarySchema,
} from '../schemas/account-movement.schema';
import { accountMovementService } from '../services/account-movement.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/accounting/account-movements/transfer
 * Transfer account movements from one account to another
 */
router.post(
  '/transfer',
  authorize({ resource: 'account-movement', action: 'edit' }),
  validate({ body: transferAccountMovementSchema }),
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

      const result = await accountMovementService.transferAccountMovement(
        companyId,
        userId,
        req.body
      );

      logger.info(
        { companyId, userId, result },
        'Account movement transfer completed'
      );

      return void res.json({
        status: 'success',
        message: 'Account movement transferred successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error transferring account movement');
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      const status =
        error instanceof Error &&
        (error.message === 'From account not found' ||
          error.message === 'To account not found' ||
          error.message === 'From account and to account cannot be the same' ||
          error.message === 'From date must be before or equal to to date' ||
          error.message ===
            'No journal entries found for the specified account and date range')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to transfer account movement',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/account-movements/summary
 * Get account movement summary
 */
router.get(
  '/summary',
  authorize({ resource: 'account-movement', action: 'view' }),
  validate({ query: accountMovementSummarySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const parsed = req.query as { accountId?: string; fromDate?: Date | string; toDate?: Date | string };
      const fromDate = parsed.fromDate instanceof Date ? parsed.fromDate : new Date(String(parsed.fromDate ?? ''));
      const toDate = parsed.toDate instanceof Date ? parsed.toDate : new Date(String(parsed.toDate ?? ''));

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return void res.status(400).json({
          status: 'error',
          message: 'Invalid date format. Use ISO 8601 format (e.g., 2025-01-15)',
        });
      }

      const result = await accountMovementService.getAccountMovementSummary(
        companyId,
        String(parsed.accountId),
        fromDate,
        toDate
      );

      return void res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting account movement summary');
      const status =
        error instanceof Error && error.message === 'Account not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get account movement summary',
      });
    }
  }
);

export default router;
