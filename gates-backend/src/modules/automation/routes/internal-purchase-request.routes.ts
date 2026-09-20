/**
 * Isolated n8n adapter: create a DRAFT PurchaseOrder.
 * Mounted at `/internal/v1/automation` with the same S2S auth as rule lookup.
 */
import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import {
  authenticateInternalAutomation,
  assertInternalCompanyAccess,
} from '../../../shared/middleware/internal-automation-auth.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { createAutomationPurchaseRequestSchema } from '../schemas/automation-purchase-request.schema';
import { automationPurchaseRequestService } from '../services/automation-purchase-request.instance';
import { AutomationPurchaseRequestError } from '../services/automation-action-run.types';

const router = Router();

router.use(authenticateInternalAutomation);

/**
 * POST /internal/v1/automation/purchase-requests
 */
router.post(
  '/purchase-requests',
  validate({ body: createAutomationPurchaseRequestSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertInternalCompanyAccess(req.body.companyId, req.internalAutomation);
      const result = await automationPurchaseRequestService.createDraftPurchaseOrder(req.body);
      return void res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      if (error instanceof AutomationPurchaseRequestError) {
        return void res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      logger.error({ error }, 'Error creating automated purchase order');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create purchase order',
      });
    }
  }
);

export default router;
